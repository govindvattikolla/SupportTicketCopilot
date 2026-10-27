import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDatabase, closeDatabase } from '../config/db';
import { Workspace } from '../modules/workspaces/workspace.model';
import { User } from '../modules/users/user.model';
import { Ticket } from '../modules/tickets/ticket.model';
import { Message } from '../modules/messages/message.model';
import { AuditEvent } from '../modules/audit/audit.model';

export const seedDatabase = async () => {
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
    },
    {
      workspaceId: workspace._id,
      name: 'Alex Agent',
      email: 'agent@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'agent' as const,
    },
    {
      workspaceId: workspace._id,
      name: 'Taylor Lead',
      email: 'lead@supportflow.com',
      passwordHash: defaultPasswordHash,
      role: 'lead' as const,
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersData) {
    let user = await User.findOne({ workspaceId: workspace._id, email: u.email });
    if (!user) {
      user = await User.create(u);
      console.log(`Created user: ${user.name} (${user.email}) [${user.role}]`);
    } else {
      console.log(`User ${user.email} already exists.`);
    }
    createdUsers[u.role] = user;
  }

  // Seed sample tickets if empty
  const existingTickets = await Ticket.countDocuments({ workspaceId: workspace._id });
  if (existingTickets === 0) {
    console.log('Seeding initial sample tickets...');

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
    ];

    for (const t of sampleTickets) {
      const ticket = await Ticket.create(t);

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
    }

    console.log('Sample tickets and conversations created successfully.');
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
