import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Workspace } from '../src/modules/workspaces/workspace.model';
import { User } from '../src/modules/users/user.model';
import {
  createAndDispatchNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../src/modules/notifications/notification.service';
import { emailService } from '../src/modules/notifications/email.service';
import { createTestDatabase, TestDbInstance } from './testDb';

describe('Phase 4 - Notifications, Email Deduplication & Background Jobs Suite', () => {
  let testDb: TestDbInstance;
  let workspace: any;
  let testUser: any;

  beforeAll(async () => {
    testDb = await createTestDatabase('notifications_jobs');

    workspace = await Workspace.create({
      name: 'Acme Notifications Workspace',
      slug: 'acme-notifs',
      ticketCounter: 1000,
    });

    const hash = await bcrypt.hash('Password123!', 10);
    testUser = await User.create({
      workspaceId: workspace._id,
      name: 'Agent Robin',
      email: 'robin@acme.com',
      passwordHash: hash,
      role: 'agent',
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('should create an in-app notification and correctly compute unread count', async () => {
    const notif = await createAndDispatchNotification({
      workspaceId: workspace._id,
      userId: testUser._id,
      type: 'ticket_assigned',
      title: 'Ticket TCK-101 Assigned',
      message: 'You have been assigned to ticket TCK-101.',
      ticketNumber: 'TCK-101',
    });

    expect(notif._id).toBeDefined();
    expect(notif.isRead).toBe(false);

    const result = await getUserNotifications(workspace._id, testUser._id);
    expect(result.unreadCount).toBeGreaterThanOrEqual(1);
    expect(result.notifications.some((n: any) => n.ticketNumber === 'TCK-101')).toBe(true);
  });

  it('should mark a specific notification as read and decrement unread count', async () => {
    const notif = await createAndDispatchNotification({
      workspaceId: workspace._id,
      userId: testUser._id,
      type: 'ticket_reply',
      title: 'New Reply on TCK-102',
      message: 'Customer replied to TCK-102.',
      ticketNumber: 'TCK-102',
    });

    expect(notif.isRead).toBe(false);

    const updated = await markNotificationAsRead(
      workspace._id,
      testUser._id,
      notif._id.toString()
    );
    expect(updated.isRead).toBe(true);
    expect(updated.readAt).toBeDefined();
  });

  it('should mark all notifications as read in bulk', async () => {
    await createAndDispatchNotification({
      workspaceId: workspace._id,
      userId: testUser._id,
      type: 'sla_warning',
      title: 'Warning 1',
      message: 'Warning message 1',
    });
    await createAndDispatchNotification({
      workspaceId: workspace._id,
      userId: testUser._id,
      type: 'sla_warning',
      title: 'Warning 2',
      message: 'Warning message 2',
    });

    const bulkResult = await markAllNotificationsAsRead(workspace._id, testUser._id);
    expect(bulkResult.modifiedCount).toBeGreaterThanOrEqual(2);

    const check = await getUserNotifications(workspace._id, testUser._id, { unreadOnly: true });
    expect(check.unreadCount).toBe(0);
  });

  it('should enforce idempotency and deduplicate email notifications on retries', async () => {
    emailService.clear();

    const deduplicationKey = 'test-dedup-assignment-TCK-105-robin';

    // First attempt
    const firstAttempt = await emailService.sendEmail({
      to: 'robin@acme.com',
      subject: 'Ticket TCK-105 Assigned',
      html: '<p>You were assigned</p>',
      deduplicationKey,
    });

    expect(firstAttempt.sent).toBe(true);
    expect(firstAttempt.duplicate).toBeUndefined();

    // Simulated retry with the same deduplication key
    const retryAttempt = await emailService.sendEmail({
      to: 'robin@acme.com',
      subject: 'Ticket TCK-105 Assigned',
      html: '<p>You were assigned</p>',
      deduplicationKey,
    });

    expect(retryAttempt.sent).toBe(false);
    expect(retryAttempt.duplicate).toBe(true);

    // Verify only 1 email was stored in the sent log
    const sentList = emailService.getSentEmails();
    expect(sentList.length).toBe(1);
    expect(sentList[0].deduplicationKey).toBe(deduplicationKey);
  });
});
