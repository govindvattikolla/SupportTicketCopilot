import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuditEvent } from './audit.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

export const getWorkspaceAuditEvents = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');

  const { page, limit, action, actorType, ticketId } = req.query;

  const filter: any = { workspaceId: req.workspaceId };

  if (action && action !== 'all') {
    filter.action = action;
  }

  if (actorType && actorType !== 'all') {
    filter['actor.type'] = actorType;
  }

  if (ticketId && Types.ObjectId.isValid(ticketId as string)) {
    filter.ticketId = new Types.ObjectId(ticketId as string);
  }

  const pageNum = Math.max(1, parseInt((page as string) || '1', 10));
  const limitNum = Math.min(100, Math.max(1, parseInt((limit as string) || '20', 10)));
  const skip = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('ticketId', 'ticketNumber subject status priority'),
    AuditEvent.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    events,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  });
};
