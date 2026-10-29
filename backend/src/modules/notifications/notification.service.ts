import { Types } from 'mongoose';
import { Notification, INotification, NotificationType } from './notification.model';
import { emitToUser } from '../../realtime/socket';
import { emailService } from './email.service';
import { User } from '../users/user.model';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError';

export interface CreateNotificationInput {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: Types.ObjectId;
  ticketNumber?: string;
  metadata?: Record<string, any>;
  sendEmail?: boolean;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const createAndDispatchNotification = async (
  input: CreateNotificationInput
): Promise<INotification> => {
  const notification = await Notification.create({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    metadata: input.metadata || {},
  });

  // 1. Real-time push via Socket.IO to recipient
  emitToUser(input.userId, 'notification:new', {
    notification,
  });

  // 2. Dispatch email notification asynchronously (if requested or for high-priority events)
  if (input.sendEmail) {
    try {
      const recipient = await User.findById(input.userId).select('name email');
      if (recipient?.email) {
        const deduplicationKey = `email-${input.type}-${input.ticketId || 'global'}-${input.userId}-${notification._id}`;
        await emailService.sendEmail({
          to: recipient.email,
          subject: `[SupportFlow] ${input.title}`,
          html: `<p>Hello ${recipient.name},</p><p>${input.message}</p><p><strong>Ticket:</strong> ${input.ticketNumber || 'N/A'}</p>`,
          deduplicationKey,
        });
      }
    } catch (err: any) {
      console.error('[NotificationService] Email delivery failed safely:', err.message);
    }
  }

  return notification;
};

export const getUserNotifications = async (
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId,
  params: GetNotificationsParams = {}
): Promise<{
  notifications: INotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  pages: number;
}> => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(params.limit) || 15));
  const skip = (page - 1) * limit;

  const filter: any = { workspaceId, userId };
  if (params.unreadOnly) {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ workspaceId, userId, isRead: false }),
  ]);

  return {
    notifications: notifications as unknown as INotification[],
    total,
    unreadCount,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
};

export const markNotificationAsRead = async (
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId,
  notificationId: string
): Promise<INotification> => {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new BadRequestError('Invalid notification ID format');
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, workspaceId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  emitToUser(userId, 'notification:read', { notificationId });

  return notification;
};

export const markAllNotificationsAsRead = async (
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<{ modifiedCount: number }> => {
  const result = await Notification.updateMany(
    { workspaceId, userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  emitToUser(userId, 'notification:read_all', { modifiedCount: result.modifiedCount });

  return { modifiedCount: result.modifiedCount };
};
