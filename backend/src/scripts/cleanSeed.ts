import { connectDatabase, closeDatabase } from '../config/db';
import { Ticket } from '../modules/tickets/ticket.model';
import { Message } from '../modules/messages/message.model';
import { TicketQuery } from '../modules/ticketQueries/ticketQuery.model';
import { AdminReport } from '../modules/adminReports/adminReport.model';
import { Notification } from '../modules/notifications/notification.model';
import { AuditEvent } from '../modules/audit/audit.model';
import { RefreshToken } from '../modules/auth/refreshToken.model';
import { Workspace } from '../modules/workspaces/workspace.model';

export const cleanSeedData = async (): Promise<void> => {
  console.log('🧹 Purging seed tickets, messages, and operational test data from database...');

  await connectDatabase();

  const [
    ticketResult,
    messageResult,
    queryResult,
    reportResult,
    notificationResult,
    auditResult,
    tokenResult,
  ] = await Promise.all([
    Ticket.deleteMany({}),
    Message.deleteMany({}),
    TicketQuery.deleteMany({}),
    AdminReport.deleteMany({}),
    Notification.deleteMany({}),
    AuditEvent.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  // Reset workspace ticket counter to 1000
  await Workspace.updateMany({}, { $set: { ticketCounter: 1000 } });

  console.log('✅ Seed data successfully removed from database:');
  console.log(`   - Tickets removed:       ${ticketResult.deletedCount}`);
  console.log(`   - Messages removed:      ${messageResult.deletedCount}`);
  console.log(`   - Ticket queries removed:${queryResult.deletedCount}`);
  console.log(`   - Admin reports removed: ${reportResult.deletedCount}`);
  console.log(`   - Notifications removed: ${notificationResult.deletedCount}`);
  console.log(`   - Audit events removed:  ${auditResult.deletedCount}`);
  console.log(`   - Refresh tokens wiped:  ${tokenResult.deletedCount}`);
  console.log('   - Ticket counter reset:  1000');

  await closeDatabase();
};

if (require.main === module || process.argv[1]?.includes('cleanSeed')) {
  cleanSeedData().catch((err) => {
    console.error('❌ Error cleaning seed data:', err);
    process.exit(1);
  });
}
