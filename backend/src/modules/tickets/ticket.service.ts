import crypto from 'crypto';
import { Types } from 'mongoose';
import { Ticket, ITicket, TicketStatus, TicketPriority, TicketCategory } from './ticket.model';
import { Message, IMessage, MessageType } from '../messages/message.model';
import { AuditEvent, IAuditEvent } from '../audit/audit.model';
import { Workspace } from '../workspaces/workspace.model';
import { User } from '../users/user.model';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import {
  calculateInitialSLADeadlines,
  calculateBusinessMinutesElapsed,
  evaluateTicketSLA,
  DEFAULT_SLA_SETTINGS,
} from '../sla/slaEngine';
import { SLAEvaluationResult } from '../sla/sla.types';
import { queueSlaCheckJob, queueNotificationJob } from '../../jobs/queues';
import { emitToWorkspace, emitToTicket, emitToUser } from '../../realtime/socket';

// Valid ticket status transitions
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['pending', 'resolved', 'closed'],
  pending: ['in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

export const isValidStatusTransition = (
  currentStatus: TicketStatus,
  targetStatus: TicketStatus
): boolean => {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
};

export interface CreatePublicTicketDTO {
  workspaceSlug?: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}

export const createPublicTicket = async (
  dto: CreatePublicTicketDTO
): Promise<{ ticket: ITicket; trackingToken: string }> => {
  // Determine target workspace (default to first active workspace if slug omitted)
  let workspace;
  if (dto.workspaceSlug) {
    workspace = await Workspace.findOne({ slug: dto.workspaceSlug.toLowerCase().trim() });
  } else {
    workspace = await Workspace.findOne().sort({ createdAt: 1 });
  }

  if (!workspace) {
    throw new NotFoundError('Target workspace not found');
  }

  // Atomically increment ticket counter for human-readable code
  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspace._id,
    { $inc: { ticketCounter: 1 } },
    { new: true }
  );

  const counter = updatedWorkspace ? updatedWorkspace.ticketCounter : 1001;
  const ticketNumber = `TCK-${counter}`;
  const trackingToken = crypto.randomBytes(32).toString('hex');

  const priority = dto.priority || workspace.settings?.defaultPriority || 'P3';
  const slaSettings = workspace.settings?.slaSettings || DEFAULT_SLA_SETTINGS;
  const now = new Date();

  // Compute SLA deadlines using business hours
  const { firstResponseDeadline, resolutionDeadline } = calculateInitialSLADeadlines(
    now,
    priority as any,
    slaSettings
  );

  const ticket = await Ticket.create({
    workspaceId: workspace._id,
    ticketNumber,
    trackingToken,
    customer: {
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
    },
    subject: dto.subject.trim(),
    description: dto.description.trim(),
    category: dto.category || 'general',
    priority,
    status: 'open',
    sla: {
      firstResponseDeadline,
      resolutionDeadline,
      isFirstResponseBreached: false,
      isResolutionBreached: false,
      isWarningSent: false,
      isEscalated: false,
      totalPausedMinutes: 0,
      pauseHistory: [],
    },
  });

  // Record initial audit event
  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId: workspace._id,
    actor: {
      type: 'customer',
      name: dto.name.trim(),
    },
    action: 'ticket_created',
    details: {
      ticketNumber,
      category: ticket.category,
      priority: ticket.priority,
      slaDeadlines: {
        firstResponse: firstResponseDeadline,
        resolution: resolutionDeadline,
      },
    },
  });

  // Real-time broadcast to workspace
  emitToWorkspace(workspace._id, 'ticket:created', { ticket });

  // Enqueue background SLA check
  await queueSlaCheckJob(ticket._id.toString());

  return { ticket, trackingToken };
};

export const getTicketByTrackingToken = async (
  trackingToken: string
): Promise<{ ticket: ITicket; messages: IMessage[] }> => {
  const ticket = await Ticket.findOne({ trackingToken });
  if (!ticket) {
    throw new NotFoundError('Invalid tracking token or ticket does not exist');
  }

  // Strictly filter only public customer replies (internal notes are completely excluded)
  const messages = await Message.find({
    ticketId: ticket._id,
    type: 'reply',
  })
    .sort({ createdAt: 1 })
    .select('-__v');

  return { ticket, messages };
};

export const addCustomerReply = async (
  trackingToken: string,
  content: string
): Promise<{ message: IMessage; ticket: ITicket }> => {
  const ticket = await Ticket.findOne({ trackingToken });
  if (!ticket) {
    throw new NotFoundError('Invalid tracking token or ticket does not exist');
  }

  if (ticket.status === 'closed') {
    const workspace = await Workspace.findById(ticket.workspaceId);
    if (!workspace?.settings?.allowCustomerReopen) {
      throw new ForbiddenError('This ticket is closed and the workspace does not permit customer reopening');
    }
    ticket.status = 'open';
    ticket.closedAt = undefined;
  } else if (ticket.status === 'resolved') {
    ticket.status = 'open';
  } else if (ticket.status === 'pending') {
    // If ticket was pending (waiting on customer), transition back to in_progress and resume SLA clock
    ticket.status = 'in_progress';
  }

  const now = new Date();

  // If resuming from pending state, adjust SLA deadlines
  if (ticket.sla?.pausedAt) {
    const workspace = await Workspace.findById(ticket.workspaceId);
    const slaSettings = workspace?.settings?.slaSettings || DEFAULT_SLA_SETTINGS;
    const pausedMinutes = calculateBusinessMinutesElapsed(
      ticket.sla.pausedAt,
      now,
      slaSettings.businessHours
    );

    if (ticket.sla.firstResponseDeadline) {
      ticket.sla.firstResponseDeadline = new Date(
        ticket.sla.firstResponseDeadline.getTime() + pausedMinutes * 60000
      );
    }
    if (ticket.sla.resolutionDeadline) {
      ticket.sla.resolutionDeadline = new Date(
        ticket.sla.resolutionDeadline.getTime() + pausedMinutes * 60000
      );
    }
    ticket.sla.totalPausedMinutes = (ticket.sla.totalPausedMinutes || 0) + pausedMinutes;
    if (ticket.sla.pauseHistory.length > 0) {
      const lastEntry = ticket.sla.pauseHistory[ticket.sla.pauseHistory.length - 1];
      if (!lastEntry.resumedAt) {
        lastEntry.resumedAt = now;
        lastEntry.pausedBusinessMinutes = pausedMinutes;
      }
    }
    ticket.sla.pausedAt = undefined;
  }

  await ticket.save();

  const message = await Message.create({
    ticketId: ticket._id,
    workspaceId: ticket.workspaceId,
    type: 'reply',
    sender: {
      type: 'customer',
      name: ticket.customer.name,
      email: ticket.customer.email,
    },
    content: content.trim(),
  });

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId: ticket.workspaceId,
    actor: {
      type: 'customer',
      name: ticket.customer.name,
    },
    action: 'customer_reply_added',
    details: { messageId: message._id },
  });

  // Real-time broadcast
  emitToWorkspace(ticket.workspaceId, 'ticket:reply', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    message,
  });
  emitToTicket(ticket._id, 'ticket:reply', {
    ticketId: ticket._id,
    message,
  });

  // Notify assigned agent about customer reply
  if (ticket.assignedTo) {
    await queueNotificationJob({
      workspaceId: ticket.workspaceId.toString(),
      userId: ticket.assignedTo.toString(),
      type: 'ticket_reply',
      title: `Customer Reply: ${ticket.ticketNumber}`,
      message: `${ticket.customer.name} replied to ticket ${ticket.ticketNumber}: "${content.substring(0, 80)}..."`,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      sendEmail: true,
    });
  }

  // Enqueue SLA check
  await queueSlaCheckJob(ticket._id.toString());

  return { message, ticket };
};

export interface ListTicketsQuery {
  status?: string;
  priority?: string;
  assignedTo?: string;
  category?: string;
  search?: string;
  overdue?: string | boolean;
  highPriority?: string | boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'priority' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export const getOverdueFilter = (): any => {
  const now = new Date();
  const h4Ago = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const h48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const h72Ago = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  return {
    status: { $in: ['open', 'in_progress', 'pending'] },
    $or: [
      { 'sla.resolutionDeadline': { $lt: now } },
      { 'sla.isResolutionBreached': true },
      { priority: 'P1', createdAt: { $lt: h4Ago } },
      { priority: 'P2', createdAt: { $lt: h24Ago } },
      { priority: 'P3', createdAt: { $lt: h48Ago } },
      { priority: 'P4', createdAt: { $lt: h72Ago } },
    ],
  };
};

export const addCustomerMessage = addCustomerReply;

export const listWorkspaceTickets = async (
  workspaceId: Types.ObjectId,
  query: ListTicketsQuery
): Promise<{
  tickets: ITicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  const filter: any = { workspaceId };

  if (query.status && query.status !== 'all') {
    if (query.status.includes(',')) {
      filter.status = { $in: query.status.split(',').map((s) => s.trim()) };
    } else {
      filter.status = query.status;
    }
  }
  if (query.priority && query.priority !== 'all') {
    filter.priority = query.priority;
  }
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }
  if (query.assignedTo) {
    if (query.assignedTo === 'unassigned') {
      filter.assignedTo = { $exists: false };
    } else if (Types.ObjectId.isValid(query.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }
  }

  if (query.overdue === 'true' || query.overdue === true) {
    const overdueCond = getOverdueFilter();
    filter.status = overdueCond.status;
    filter.$or = overdueCond.$or;
  }

  if (query.highPriority === 'true' || query.highPriority === true) {
    filter.priority = { $in: ['P1', 'P2'] };
    if (!filter.status) {
      filter.status = { $nin: ['resolved', 'closed'] };
    }
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { ticketNumber: searchRegex },
      { subject: searchRegex },
      { 'customer.name': searchRegex },
      { 'customer.email': searchRegex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 15));
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sort: any = { [sortBy]: sortOrder };

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('assignedTo', '_id name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);

  return {
    tickets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getWorkspaceTicketDetails = async (
  workspaceId: Types.ObjectId,
  ticketId: string
): Promise<{
  ticket: ITicket;
  messages: IMessage[];
  auditEvents: IAuditEvent[];
  slaEvaluation: SLAEvaluationResult;
}> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  // Strictly enforce workspace isolation
  const [ticket, workspace] = await Promise.all([
    Ticket.findOne({ _id: ticketId, workspaceId }).populate('assignedTo', '_id name email role'),
    Workspace.findById(workspaceId),
  ]);

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  const slaSettings = workspace?.settings?.slaSettings || DEFAULT_SLA_SETTINGS;
  const slaEvaluation = evaluateTicketSLA(ticket as any, slaSettings);

  const [messages, auditEvents] = await Promise.all([
    Message.find({ ticketId: ticket._id, workspaceId }).sort({ createdAt: 1 }),
    AuditEvent.find({ ticketId: ticket._id, workspaceId }).sort({ createdAt: -1 }),
  ]);

  return { ticket, messages, auditEvents, slaEvaluation };
};

export const updateTicketStatus = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  newStatus: TicketStatus,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const [ticket, workspace] = await Promise.all([
    Ticket.findOne({ _id: ticketId, workspaceId }),
    Workspace.findById(workspaceId),
  ]);

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  if (!isValidStatusTransition(ticket.status, newStatus)) {
    throw new BadRequestError(
      `Invalid status transition from '${ticket.status}' to '${newStatus}'. Permitted transitions: ${
        VALID_STATUS_TRANSITIONS[ticket.status].join(', ') || 'none'
      }`
    );
  }

  const previousStatus = ticket.status;
  ticket.status = newStatus;
  const now = new Date();
  const slaSettings = workspace?.settings?.slaSettings || DEFAULT_SLA_SETTINGS;

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

  // PAUSE SLA CLOCK: When status becomes 'pending'
  if (newStatus === 'pending') {
    if (!ticket.sla.pausedAt) {
      ticket.sla.pausedAt = now;
      ticket.sla.pauseHistory.push({
        pausedAt: now,
        reason: 'Waiting on customer reply',
      });
    }
  }

  // RESUME SLA CLOCK: When status leaves 'pending' back to active work
  if (previousStatus === 'pending' && (newStatus === 'open' || newStatus === 'in_progress')) {
    if (ticket.sla.pausedAt) {
      const pausedMinutes = calculateBusinessMinutesElapsed(
        ticket.sla.pausedAt,
        now,
        slaSettings.businessHours
      );

      // Adjust remaining deadlines forward by paused business minutes
      if (ticket.sla.firstResponseDeadline) {
        ticket.sla.firstResponseDeadline = new Date(
          ticket.sla.firstResponseDeadline.getTime() + pausedMinutes * 60000
        );
      }
      if (ticket.sla.resolutionDeadline) {
        ticket.sla.resolutionDeadline = new Date(
          ticket.sla.resolutionDeadline.getTime() + pausedMinutes * 60000
        );
      }

      ticket.sla.totalPausedMinutes = (ticket.sla.totalPausedMinutes || 0) + pausedMinutes;

      if (ticket.sla.pauseHistory.length > 0) {
        const lastEntry = ticket.sla.pauseHistory[ticket.sla.pauseHistory.length - 1];
        if (!lastEntry.resumedAt) {
          lastEntry.resumedAt = now;
          lastEntry.pausedBusinessMinutes = pausedMinutes;
        }
      }

      ticket.sla.pausedAt = undefined;
    }
  }

  if (newStatus === 'resolved') {
    ticket.resolvedAt = now;
    ticket.sla.resolutionAchievedAt = now;
    if (ticket.sla.resolutionDeadline && now > ticket.sla.resolutionDeadline) {
      ticket.sla.isResolutionBreached = true;
    }
  } else if (newStatus === 'closed') {
    ticket.closedAt = now;
    if (!ticket.sla.resolutionAchievedAt) {
      ticket.sla.resolutionAchievedAt = now;
    }
    if (ticket.sla.resolutionDeadline && now > ticket.sla.resolutionDeadline) {
      ticket.sla.isResolutionBreached = true;
    }
  } else if (newStatus === 'open' || newStatus === 'in_progress') {
    ticket.closedAt = undefined;
    ticket.sla.resolutionAchievedAt = undefined;
  }

  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: 'status_changed',
    details: { from: previousStatus, to: newStatus },
  });

  // Real-time broadcast
  emitToWorkspace(workspaceId, 'ticket:status_changed', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    from: previousStatus,
    to: newStatus,
  });
  emitToTicket(ticket._id, 'ticket:status_changed', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    from: previousStatus,
    to: newStatus,
  });

  // In-app notification to assignee if someone else modified status
  if (ticket.assignedTo && ticket.assignedTo.toString() !== actor.userId.toString()) {
    await queueNotificationJob({
      workspaceId: workspaceId.toString(),
      userId: ticket.assignedTo.toString(),
      type: 'status_changed',
      title: `Status Changed: ${ticket.ticketNumber}`,
      message: `${actor.name} changed status of ${ticket.ticketNumber} from ${previousStatus} to ${newStatus}.`,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
    });
  }

  // Enqueue SLA check
  await queueSlaCheckJob(ticket._id.toString());

  return ticket;
};

export const updateTicketPriority = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  newPriority: TicketPriority,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const [ticket, workspace] = await Promise.all([
    Ticket.findOne({ _id: ticketId, workspaceId }),
    Workspace.findById(workspaceId),
  ]);

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  const previousPriority = ticket.priority;
  ticket.priority = newPriority;

  // Recompute SLA deadlines based on new priority targets
  const slaSettings = workspace?.settings?.slaSettings || DEFAULT_SLA_SETTINGS;
  const { firstResponseDeadline, resolutionDeadline } = calculateInitialSLADeadlines(
    ticket.createdAt,
    newPriority as any,
    slaSettings
  );

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

  // Shift by existing paused minutes
  const totalPaused = ticket.sla.totalPausedMinutes || 0;
  ticket.sla.firstResponseDeadline = new Date(firstResponseDeadline.getTime() + totalPaused * 60000);
  ticket.sla.resolutionDeadline = new Date(resolutionDeadline.getTime() + totalPaused * 60000);

  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: 'priority_changed',
    details: { from: previousPriority, to: newPriority },
  });

  emitToWorkspace(workspaceId, 'ticket:priority_changed', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    priority: newPriority,
  });
  emitToTicket(ticket._id, 'ticket:priority_changed', {
    ticketId: ticket._id,
    priority: newPriority,
  });

  // Enqueue SLA re-evaluation
  await queueSlaCheckJob(ticket._id.toString());

  return ticket;
};

export const assignTicket = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  assignedToUserId: string | null,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  const previousAssignee = ticket.assignedTo;
  let assignedUserName = 'Unassigned';

  if (assignedToUserId) {
    if (!Types.ObjectId.isValid(assignedToUserId)) {
      throw new BadRequestError('Invalid agent identifier');
    }

    const assignedUser = await User.findOne({
      _id: assignedToUserId,
      workspaceId,
      isActive: true,
    });

    if (!assignedUser) {
      throw new BadRequestError('Assignee does not exist or is not an active member of this workspace');
    }

    ticket.assignedTo = assignedUser._id;
    assignedUserName = assignedUser.name;
  } else {
    ticket.assignedTo = undefined;
  }

  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: assignedToUserId ? 'ticket_assigned' : 'ticket_unassigned',
    details: {
      assignedTo: assignedToUserId,
      assignedToName: assignedUserName,
    },
  });

  // Real-time broadcast
  emitToWorkspace(workspaceId, 'ticket:assigned', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    assignedTo: ticket.assignedTo,
    assignedUserName,
  });
  emitToTicket(ticket._id, 'ticket:assigned', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    assignedTo: ticket.assignedTo,
    assignedUserName,
  });

  // Enqueue Notification for the new assignee
  if (assignedToUserId && assignedToUserId !== actor.userId.toString()) {
    const isReassignment = !!previousAssignee && previousAssignee.toString() !== assignedToUserId;
    await queueNotificationJob({
      workspaceId: workspaceId.toString(),
      userId: assignedToUserId,
      type: isReassignment ? 'ticket_reassigned' : 'ticket_assigned',
      title: isReassignment ? `Ticket Reassigned: ${ticket.ticketNumber}` : `New Ticket Assigned: ${ticket.ticketNumber}`,
      message: `${actor.name} assigned ticket ${ticket.ticketNumber} ("${ticket.subject}") to you.`,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      sendEmail: true,
    });
  }

  return ticket;
};

export const addStaffMessage = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  type: MessageType,
  content: string,
  actor: { userId: Types.ObjectId; name: string; email: string }
): Promise<IMessage> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  if (!content || !content.trim()) {
    throw new BadRequestError('Message content cannot be empty');
  }

  const message = await Message.create({
    ticketId: ticket._id,
    workspaceId,
    type,
    sender: {
      type: 'agent',
      userId: actor.userId,
      name: actor.name,
      email: actor.email,
    },
    content: content.trim(),
  });

  const now = new Date();

  // If this is the first public reply from staff, record firstResponseAt and evaluate breach
  if (type === 'reply' && !ticket.firstResponseAt) {
    ticket.firstResponseAt = now;
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
    ticket.sla.firstResponseAchievedAt = now;
    if (ticket.sla.firstResponseDeadline && now > ticket.sla.firstResponseDeadline) {
      ticket.sla.isFirstResponseBreached = true;
    }
    await ticket.save();
  }

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: type === 'reply' ? 'staff_reply_added' : 'internal_note_added',
    details: { messageId: message._id },
  });

  // Real-time broadcast
  emitToWorkspace(workspaceId, 'ticket:reply', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    messageId: message._id,
    type,
    sender: message.sender,
  });
  emitToTicket(ticket._id, 'ticket:reply', {
    ticketId: ticket._id,
    message,
  });

  // Notify assignee if another staff member left a reply or note
  if (ticket.assignedTo && ticket.assignedTo.toString() !== actor.userId.toString()) {
    await queueNotificationJob({
      workspaceId: workspaceId.toString(),
      userId: ticket.assignedTo.toString(),
      type: 'ticket_reply',
      title: `New ${type === 'internal_note' ? 'Internal Note' : 'Reply'} on ${ticket.ticketNumber}`,
      message: `${actor.name} added a ${type === 'internal_note' ? 'private note' : 'reply'} to ${ticket.ticketNumber}.`,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
    });
  }

  return message;
};
