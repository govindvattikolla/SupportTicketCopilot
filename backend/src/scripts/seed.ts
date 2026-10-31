import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDatabase, closeDatabase } from '../config/db';
import { Workspace } from '../modules/workspaces/workspace.model';
import { User } from '../modules/users/user.model';
import { Ticket } from '../modules/tickets/ticket.model';
import { Message } from '../modules/messages/message.model';
import { AuditEvent } from '../modules/audit/audit.model';
import { TicketQuery } from '../modules/ticketQueries/ticketQuery.model';
import { AdminReport } from '../modules/adminReports/adminReport.model';
import { Notification } from '../modules/notifications/notification.model';
import { calculateInitialSLADeadlines, DEFAULT_SLA_SETTINGS } from '../modules/sla/slaEngine';

export const seedDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to seed demo data in a production environment.');
    throw new Error('Seed script disabled in production');
  }

  console.log('🌱 Starting database seed for SupportFlow...');

  await connectDatabase();

  // Create or retrieve workspace
  let workspace = await Workspace.findOne({ slug: 'demo' });
  if (!workspace) {
    workspace = await Workspace.create({
      name: 'Acme SaaS Support',
      slug: 'demo',
      ticketCounter: 1005,
      settings: {
        defaultPriority: 'P3',
        allowCustomerReopen: true,
      },
    });
    console.log(`Created workspace: ${workspace.name} (${workspace.slug})`);
  } else {
    console.log(`Workspace ${workspace.slug} already exists.`);
  }

  // Create default users
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  const usersData = [
    {
      workspaceId: workspace._id,
      name: 'Sarah Admin',
      email: 'admin@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'admin' as const,
      skills: ['general', 'billing'],
      maxCapacity: 10,
    },
    {
      workspaceId: workspace._id,
      name: 'Alex Agent',
      email: 'agent@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'agent' as const,
      skills: ['billing', 'general'],
      maxCapacity: 5,
    },
    {
      workspaceId: workspace._id,
      name: 'Taylor Lead',
      email: 'lead@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'lead' as const,
      skills: ['technical', 'bug'],
      maxCapacity: 8,
    },
    {
      workspaceId: workspace._id,
      name: 'Jordan Tech',
      email: 'jordan@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'agent' as const,
      skills: ['technical', 'bug'],
      maxCapacity: 5,
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersData) {
    let user = await User.findOne({ workspaceId: workspace._id, email: u.email });
    if (!user) {
      user = await User.create(u);
      console.log(`Created user: ${user.name} (${user.email}) [${user.role}]`);
    } else {
      user.skills = u.skills;
      user.maxCapacity = u.maxCapacity;
      await user.save();
      console.log(`User ${user.email} updated with skills: ${u.skills.join(', ')}.`);
    }
    createdUsers[u.role] = user;
    if (u.email === 'jordan@supportflow.com') {
      createdUsers['agent2'] = user;
    }
  }

  // Seed sample tickets (idempotently ensure all sample tickets exist)
  console.log('Checking sample tickets...');

    const sampleTickets = [
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1001',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'John Doe', email: 'john@example.com' },
        subject: 'Cannot access billing invoice PDF',
        description:
          'When clicking on the download button in settings > billing, the page displays a 403 Forbidden error.',
        category: 'billing' as const,
        priority: 'P2' as const,
        status: 'open' as const,
        assignedTo: createdUsers['agent']._id,
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1002',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Emma Watson', email: 'emma@clientcorp.io' },
        subject: 'Critical API latency spike on webhook callbacks',
        description:
          'Over the last 2 hours, webhook deliveries are timing out after 10 seconds. Is there an outage?',
        category: 'technical' as const,
        priority: 'P1' as const,
        status: 'in_progress' as const,
        assignedTo: createdUsers['lead']._id,
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1003',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'David Lee', email: 'david@startup.co' },
        subject: 'How do I add multiple team members?',
        description: 'We recently upgraded to Pro plan and want to invite 5 additional developers.',
        category: 'general' as const,
        priority: 'P3' as const,
        status: 'pending' as const,
        assignedTo: createdUsers['agent']._id,
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1004',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Lisa Ray', email: 'lisa@enterprise.com' },
        subject: 'SSO configuration with Okta completed',
        description: 'Thank you for your assistance with SAML 2.0 metadata setup. Everything works!',
        category: 'technical' as const,
        priority: 'P3' as const,
        status: 'resolved' as const,
        resolvedAt: new Date(),
        assignedTo: createdUsers['agent']._id,
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1005',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Marcus Brody', email: 'marcus@indyfintech.com' },
        subject: 'Database connection pools exhausted during peak hours',
        description:
          'Our microservice is throwing 500 errors when connecting to SupportFlow API due to sudden rate limit drop.',
        category: 'technical' as const,
        priority: 'P1' as const,
        status: 'open' as const,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago -> Overdue P1
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1006',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Elena Rostova', email: 'elena@cybersec.org' },
        subject: 'Security vulnerability report: CSP header missing on subdomains',
        description:
          'We ran a routine vulnerability scan and observed that *.supportflow.com lacks strict Content-Security-Policy headers.',
        category: 'bug' as const,
        priority: 'P2' as const,
        status: 'open' as const,
        createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago -> Overdue P2, Unassigned
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1007',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Carlos Mendez', email: 'carlos@growthhub.co' },
        subject: 'Requesting webhook payload customization for HubSpot CRM sync',
        description:
          'We would love to include custom user metadata inside the webhook payload for closed ticket events.',
        category: 'feature_request' as const,
        priority: 'P4' as const,
        status: 'in_progress' as const,
        assignedTo: createdUsers['agent']._id,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        workspaceId: workspace._id,
        ticketNumber: 'TCK-1008',
        trackingToken: crypto.randomBytes(32).toString('hex'),
        customer: { name: 'Kevin Durant', email: 'kevin@streamline.net' },
        subject: 'Webhook endpoint callbacks timing out after 10s',
        description:
          'Webhook deliveries are timing out after 10 seconds on our production webhook endpoint callbacks.',
        category: 'technical' as const,
        priority: 'P1' as const,
        status: 'open' as const,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    ];

    for (const t of sampleTickets) {
      let ticket = await Ticket.findOne({ workspaceId: workspace._id, ticketNumber: t.ticketNumber });
      if (!ticket) {
        ticket = await Ticket.create(t);

        // Audit event
        await AuditEvent.create({
          ticketId: ticket._id,
          workspaceId: workspace._id,
          actor: { type: 'customer', name: ticket.customer.name },
          action: 'ticket_created',
          details: { ticketNumber: ticket.ticketNumber, priority: ticket.priority },
        });

        // Sample customer initial message
        await Message.create({
          ticketId: ticket._id,
          workspaceId: workspace._id,
          type: 'reply',
          sender: {
            type: 'customer',
            name: ticket.customer.name,
            email: ticket.customer.email,
          },
          content: ticket.description,
        });

        // Sample internal note for TCK-1002
        if (ticket.ticketNumber === 'TCK-1002') {
          await Message.create({
            ticketId: ticket._id,
            workspaceId: workspace._id,
            type: 'internal_note',
            sender: {
              type: 'agent',
              userId: createdUsers['lead']._id,
              name: createdUsers['lead'].name,
              email: createdUsers['lead'].email,
            },
            content: 'Investigating webhook worker cluster. CPU usage is currently normal.',
          });
        }
        console.log(`Created sample ticket ${ticket.ticketNumber} (${ticket.subject})`);
      }
    }

    if (!workspace.ticketCounter || workspace.ticketCounter < 1008) {
      workspace.ticketCounter = 1008;
      await workspace.save();
    }
    console.log('Sample tickets checked/created successfully.');

  // Seed sample ticket queries (Agent <-> Lead) if empty
  const existingQueries = await TicketQuery.countDocuments({ workspaceId: workspace._id });
  if (existingQueries === 0) {
    const ticket1001 = await Ticket.findOne({ workspaceId: workspace._id, ticketNumber: 'TCK-1001' });
    const ticket1002 = await Ticket.findOne({ workspaceId: workspace._id, ticketNumber: 'TCK-1002' });

    if (ticket1001) {
      await TicketQuery.create({
        workspaceId: workspace._id,
        ticketId: ticket1001._id,
        ticketNumber: ticket1001.ticketNumber,
        agentId: createdUsers['agent']._id,
        agentName: createdUsers['agent'].name,
        leadId: createdUsers['lead']._id,
        leadName: createdUsers['lead'].name,
        subject: 'Customer requesting manual PDF invoice generation for tax audit',
        category: 'refund_approval',
        urgency: 'high',
        status: 'in_review',
        messages: [
          {
            senderId: createdUsers['agent']._id,
            senderName: createdUsers['agent'].name,
            senderRole: 'agent',
            message:
              'The billing portal is throwing a 403 error for John Doe. Can we approve a manual invoice PDF generation from Stripe dashboard and send it directly?',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            senderId: createdUsers['lead']._id,
            senderName: createdUsers['lead'].name,
            senderRole: 'lead',
            message:
              'Yes, go ahead and export the PDF from Stripe for invoice #INV-8891 and email it. I will report the 403 bug to Admin for engineering review.',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          },
        ],
      });
    }

    if (ticket1002) {
      await TicketQuery.create({
        workspaceId: workspace._id,
        ticketId: ticket1002._id,
        ticketNumber: ticket1002.ticketNumber,
        agentId: createdUsers['agent']._id,
        agentName: createdUsers['agent'].name,
        subject: 'Clarification on webhook retry timeout policy for enterprise tier',
        category: 'technical',
        urgency: 'urgent',
        status: 'open',
        messages: [
          {
            senderId: createdUsers['agent']._id,
            senderName: createdUsers['agent'].name,
            senderRole: 'agent',
            message:
              'Emma Watson is asking if enterprise webhook delivery guarantees include automatic exponential retries up to 72 hours. What SLA policy should I quote?',
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
          },
        ],
      });
    }

    console.log('Sample ticket queries seeded successfully.');
  }

  // Seed sample operational reports (Lead <-> Admin) if empty
  const existingReports = await AdminReport.countDocuments({ workspaceId: workspace._id });
  if (existingReports === 0) {
    const ticket1005 = await Ticket.findOne({ workspaceId: workspace._id, ticketNumber: 'TCK-1005' });

    await AdminReport.create({
      workspaceId: workspace._id,
      leadId: createdUsers['lead']._id,
      leadName: createdUsers['lead'].name,
      title: 'Cluster Database Connection Pool Exhaustion Incident',
      category: 'incident_escalation',
      priority: 'critical',
      status: 'in_progress',
      summary:
        'Multiple customers (e.g. TCK-1005) experienced rate-limit spikes and 500 errors during morning peak traffic due to DB pool exhaustion. Microservice workers failed to release connection handles.',
      actionRequired:
        'Requesting DevOps infrastructure team increase max connection pool from 50 to 150 on the US-East cluster and schedule bugfix patch.',
      ticketId: ticket1005?._id,
      ticketNumber: ticket1005?.ticketNumber,
      messages: [
        {
          senderId: createdUsers['lead']._id,
          senderName: createdUsers['lead'].name,
          senderRole: 'lead',
          message:
            'Elevating DB pool exhaustion incident. We have open tickets from enterprise clients.',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        },
        {
          senderId: createdUsers['admin']._id,
          senderName: createdUsers['admin'].name,
          senderRole: 'admin',
          message:
            'Acknowledged. DevOps has deployed hotfix #441 expanding connection limits to 200. Please monitor error logs over the next 2 hours.',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ],
      adminDirective:
        'DevOps patch deployed. Keep ticket TCK-1005 open until client confirms stable callback rate.',
    });

    await AdminReport.create({
      workspaceId: workspace._id,
      leadId: createdUsers['lead']._id,
      leadName: createdUsers['lead'].name,
      title: 'Tier 1 Agent Coverage & Shift Scheduling Deficit',
      category: 'staffing_capacity',
      priority: 'high',
      status: 'submitted',
      summary:
        'Current weekend shift coverage is insufficient. Overdue P1/P2 tickets increased by 25% due to 1 agent out on planned sick leave.',
      actionRequired:
        'Request approval to onboard 2 additional part-time support agents or authorize overtime hours.',
      messages: [
        {
          senderId: createdUsers['lead']._id,
          senderName: createdUsers['lead'].name,
          senderRole: 'lead',
          message:
            'Submitting staffing analysis for Q4 support volume surge. Need executive review on adding 2 contractor slots.',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });

    console.log('Sample admin operational reports seeded successfully.');
  }

  // Ensure all seeded tickets have SLA deadlines calculated
  const allTickets = await Ticket.find({ workspaceId: workspace._id });
  for (const t of allTickets) {
    if (!t.sla || !t.sla.resolutionDeadline) {
      const { firstResponseDeadline, resolutionDeadline } = calculateInitialSLADeadlines(
        t.createdAt,
        t.priority as any,
        workspace.settings?.slaSettings || DEFAULT_SLA_SETTINGS
      );
      t.sla = {
        firstResponseDeadline,
        resolutionDeadline,
        isFirstResponseBreached: t.priority === 'P1' && t.ticketNumber === 'TCK-1005',
        isResolutionBreached: t.priority === 'P1' && t.ticketNumber === 'TCK-1005',
        isWarningSent: true,
        isEscalated: t.ticketNumber === 'TCK-1005',
        totalPausedMinutes: 0,
        pauseHistory: [],
      };
      await t.save();
    }
  }

  // Seed sample in-app notifications if empty
  const existingNotifs = await Notification.countDocuments({ workspaceId: workspace._id });
  if (existingNotifs === 0) {
    console.log('Seeding initial notifications...');
    await Notification.create([
      {
        workspaceId: workspace._id,
        userId: createdUsers['agent']._id,
        type: 'ticket_assigned',
        title: 'New Ticket Assigned: TCK-1001',
        message: 'Sarah Admin assigned ticket TCK-1001 ("Cannot access billing invoice PDF") to you.',
        ticketNumber: 'TCK-1001',
        isRead: false,
      },
      {
        workspaceId: workspace._id,
        userId: createdUsers['agent']._id,
        type: 'sla_warning',
        title: 'SLA Warning: Ticket TCK-1005',
        message: 'Ticket TCK-1005 is approaching its first response SLA deadline (80% elapsed).',
        ticketNumber: 'TCK-1005',
        isRead: false,
      },
      {
        workspaceId: workspace._id,
        userId: createdUsers['lead']._id,
        type: 'sla_breached',
        title: 'SLA Escalation: Ticket TCK-1005',
        message: 'High-priority ticket TCK-1005 has breached its first response SLA commitment. Supervisor attention required.',
        ticketNumber: 'TCK-1005',
        isRead: false,
      },
      {
        workspaceId: workspace._id,
        userId: createdUsers['agent']._id,
        type: 'ticket_reply',
        title: 'Customer Reply: TCK-1002',
        message: 'Emma Watson replied to ticket TCK-1002 ("Critical API latency spike on webhook callbacks").',
        ticketNumber: 'TCK-1002',
        isRead: true,
        readAt: new Date(),
      },
    ]);
  }

  console.log(`
🎉 Database seed complete!
----------------------------------------------
🏢 Workspace:   Acme SaaS Support (slug: demo)
🔑 Admin User:  admin@supportflow.com (Pass: Password123!)
🔑 Agent User:  agent@supportflow.com (Pass: Password123!)
🔑 Lead User:   lead@supportflow.com (Pass: Password123!)
----------------------------------------------
  `);

  await closeDatabase();
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
