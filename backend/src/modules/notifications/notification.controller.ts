import { Request, Response } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './notification.service';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

export const handleGetNotifications = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const { page, limit, unreadOnly } = req.query;

  const result = await getUserNotifications(req.workspaceId, req.user._id, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    unreadOnly: unreadOnly === 'true',
  });

  return sendSuccess(res, result, 'Notifications retrieved successfully');
};

export const handleMarkNotificationRead = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const { id } = req.params;
  const updated = await markNotificationAsRead(req.workspaceId, req.user._id, id);

  return sendSuccess(res, updated, 'Notification marked as read');
};

export const handleMarkAllNotificationsRead = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const result = await markAllNotificationsAsRead(req.workspaceId, req.user._id);

  return sendSuccess(res, result, 'All notifications marked as read');
};
