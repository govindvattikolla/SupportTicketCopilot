import { Request, Response } from 'express';
import { z } from 'zod';
import {
  listWorkspaceTickets,
  getWorkspaceTicketDetails,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
  addStaffMessage,
} from './ticket.service';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

const statusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']),
});

const prioritySchema = z.object({
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
});

const assignSchema = z.object({
  assignedTo: z.string().nullable(),
});

const messageSchema = z.object({
  type: z.enum(['reply', 'internal_note']),
  content: z.string().min(1, 'Message cannot be empty').max(10000),
});

export const getTickets = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');

  const { status, priority, assignedTo, category, search, page, limit, sortBy, sortOrder } =
    req.query;

  const result = await listWorkspaceTickets(req.workspaceId, {
    status: status as string,
    priority: priority as string,
    assignedTo: assignedTo as string,
    category: category as string,
    search: search as string,
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? parseInt(limit as string, 10) : 15,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any,
  });

  return sendSuccess(res, result);
};

export const getTicketDetails = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;

  const result = await getWorkspaceTicketDetails(req.workspaceId, id);
  return sendSuccess(res, result);
};

export const changeStatus = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;
  const { status } = statusSchema.parse(req.body);

  const updatedTicket = await updateTicketStatus(req.workspaceId, id, status, {
    userId: req.user._id,
    name: req.user.name,
  });

  return sendSuccess(res, updatedTicket, `Status changed to ${status}`);
};

export const changePriority = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;
  const { priority } = prioritySchema.parse(req.body);

  const updatedTicket = await updateTicketPriority(req.workspaceId, id, priority, {
    userId: req.user._id,
    name: req.user.name,
  });

  return sendSuccess(res, updatedTicket, `Priority changed to ${priority}`);
};

export const assignAgent = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;
  const { assignedTo } = assignSchema.parse(req.body);

  const updatedTicket = await assignTicket(req.workspaceId, id, assignedTo, {
    userId: req.user._id,
    name: req.user.name,
  });

  return sendSuccess(
    res,
    updatedTicket,
    assignedTo ? 'Ticket assigned successfully' : 'Ticket unassigned'
  );
};

export const postMessage = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;
  const { type, content } = messageSchema.parse(req.body);

  const message = await addStaffMessage(req.workspaceId, id, type, content, {
    userId: req.user._id,
    name: req.user.name,
    email: req.user.email,
  });

  return sendSuccess(
    res,
    message,
    type === 'reply' ? 'Reply sent to customer' : 'Internal note saved',
    201
  );
};
