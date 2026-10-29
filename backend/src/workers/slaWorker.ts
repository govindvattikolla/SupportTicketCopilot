import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisClient } from '../shared/redis';
import { SLA_QUEUE_NAME } from '../jobs/queues';
import { Ticket } from '../modules/tickets/ticket.model';
import { Workspace } from '../modules/workspaces/workspace.model';
import { AuditEvent } from '../modules/audit/audit.model';
import { evaluateTicketSLA, DEFAULT_SLA_SETTINGS } from '../modules/sla/slaEngine';
import { createAndDispatchNotification } from '../modules/notifications/notification.service';
import { emitToWorkspace, emitToTicket } from '../realtime/socket';
import { User } from '../modules/users/user.model';

export const processSlaTicketCheck = async (ticketId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(ticketId)) return;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket || ticket.status === 'resolved' || ticket.status === 'closed') {
    return;
  }

  const workspace = await Workspace.findById(ticket.workspaceId);
  const slaSettings = workspace?.settings?.slaSettings || DEFAULT_SLA_SETTINGS;
  if (!slaSettings.enabled) return;

  const now = new Date();
  const evaluation = evaluateTicketSLA(ticket as any, slaSettings, now);

  let modified = false;
  if (!ticket.sla) {
    ticket.sla = {
      isFirstResponseBreached: false,
      isResolutionBreached: false,
      isWarningSent: false,
      isEscalated: false,
      totalPausedMinutes: 0,
      pauseHistory: [],
    };
  }

  // 1. Detect Approaching Warning
  if (
    evaluation.overallStatus === 'warning' &&
    !ticket.sla.isWarningSent &&
    !ticket.sla.isFirstResponseBreached &&
    !ticket.sla.isResolutionBreached
  ) {
    ticket.sla.isWarningSent = true;
    modified = true;

    // Send notification to assigned agent or team leads
    const recipientId = ticket.assignedTo;
    if (recipientId) {
      await createAndDispatchNotification({
        workspaceId: ticket.workspaceId,
        userId: recipientId,
        type: 'sla_warning',
        title: `SLA Warning: Ticket ${ticket.ticketNumber}`,
        message: `Ticket ${ticket.ticketNumber} is approaching its SLA target deadline! Please review and take action.`,
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        sendEmail: true,
      });
    }

    emitToWorkspace(ticket.workspaceId, 'ticket:sla_warning', {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      priority: ticket.priority,
    });
    emitToTicket(ticket._id, 'ticket:sla_warning', {
      ticketId: ticket._id,
      evaluation,
    });

    await AuditEvent.create({
      ticketId: ticket._id,
      workspaceId: ticket.workspaceId,
      actor: { type: 'system', name: 'SLA Engine' },
      action: 'sla_warning_triggered',
      details: {
        percentElapsed: Math.max(
          evaluation.firstResponse.percentElapsed,
          evaluation.resolution.percentElapsed
        ),
      },
    });
  }

  // 2. Detect Breached Deadline
  if (evaluation.overallStatus === 'breached') {
    let newlyBreached = false;

    if (evaluation.firstResponse.isBreached && !ticket.sla.isFirstResponseBreached) {
      ticket.sla.isFirstResponseBreached = true;
      newlyBreached = true;
      modified = true;
    }

    if (evaluation.resolution.isBreached && !ticket.sla.isResolutionBreached) {
      ticket.sla.isResolutionBreached = true;
      newlyBreached = true;
      modified = true;
    }

    if (newlyBreached || !ticket.sla.isEscalated) {
      ticket.sla.isEscalated = true;
      modified = true;

      // Escalate to Team Leads and assigned agent
      const leads = await User.find({
        workspaceId: ticket.workspaceId,
        role: { $in: ['lead', 'admin'] },
        isActive: true,
      });

      for (const lead of leads) {
        await createAndDispatchNotification({
          workspaceId: ticket.workspaceId,
          userId: lead._id,
          type: 'sla_breached',
          title: `SLA Breached: Ticket ${ticket.ticketNumber}`,
          message: `Ticket ${ticket.ticketNumber} (${ticket.priority}) has breached its SLA commitment! Urgent supervisor review required.`,
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          sendEmail: true,
        });
      }

      emitToWorkspace(ticket.workspaceId, 'ticket:sla_breached', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        priority: ticket.priority,
      });
      emitToTicket(ticket._id, 'ticket:sla_breached', {
        ticketId: ticket._id,
        evaluation,
      });

      await AuditEvent.create({
        ticketId: ticket._id,
        workspaceId: ticket.workspaceId,
        actor: { type: 'system', name: 'SLA Engine' },
        action: 'sla_breached',
        details: {
          firstResponseBreached: ticket.sla.isFirstResponseBreached,
          resolutionBreached: ticket.sla.isResolutionBreached,
          breachedAt: now,
        },
      });
    }
  }

  if (modified) {
    await ticket.save();
  }
};

/**
 * Scans all open/in_progress/pending tickets across active workspaces to check SLA deadlines
 */
export const scanAllActiveTicketsSLA = async (): Promise<number> => {
  const activeTickets = await Ticket.find({
    status: { $in: ['open', 'in_progress', 'pending'] },
  }).select('_id');

  for (const t of activeTickets) {
    try {
      await processSlaTicketCheck(t._id.toString());
    } catch (err: any) {
      console.error(`[SLAWorker] Error checking ticket ${t._id}:`, err.message);
    }
  }

  return activeTickets.length;
};

export const createSlaWorker = (): Worker => {
  const connection = getRedisClient();
  const worker = new Worker(
    SLA_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'check-ticket-sla') {
        const { ticketId } = job.data;
        await processSlaTicketCheck(ticketId);
      } else if (job.name === 'scan-all-sla') {
        await scanAllActiveTicketsSLA();
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[SLAWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
