import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createTicketQuery,
  listTicketQueries,
  getTicketQueryById,
  addTicketQueryMessage,
  updateTicketQueryStatus,
} from './ticketQuery.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

const createTicketQuerySchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  category: z.enum([
    'technical',
    'refund_approval',
    'policy_guidance',
    'sla_escalation',
    'customer_dispute',
    'other',
  ]),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']),
  message: z.string().min(5, 'Message must be at least 5 characters').max(3000),
  leadId: z.string().optional(),
});

const addMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(3000),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'closed']),
  resolutionSummary: z.string().max(1000).optional(),
});

export const handleCreateTicketQuery = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = createTicketQuerySchema.parse(req.body);
  const query = await createTicketQuery(req.workspaceId, req.user, parsed);

  return sendCreated(res, query, 'Ticket query sent to Team Lead successfully');
};

export const handleListTicketQueries = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const { status, urgency, category, ticketId, agentId, page, limit } = req.query;

  const result = await listTicketQueries(req.workspaceId, req.user, {
    status: status as string,
    urgency: urgency as string,
    category: category as string,
    ticketId: ticketId as string,
    agentId: agentId as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return sendSuccess(res, result, 'Ticket queries retrieved');
};

export const handleGetTicketQueryById = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const query = await getTicketQueryById(req.workspaceId, req.params.id, req.user);
  return sendSuccess(res, query, 'Ticket query details retrieved');
};

export const handleAddTicketQueryMessage = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = addMessageSchema.parse(req.body);
  const updatedQuery = await addTicketQueryMessage(
    req.workspaceId,
    req.params.id,
    req.user,
    parsed.message
  );

  return sendSuccess(res, updatedQuery, 'Message added to query conversation');
};

export const handleUpdateTicketQueryStatus = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = updateStatusSchema.parse(req.body);
  const updatedQuery = await updateTicketQueryStatus(
    req.workspaceId,
    req.params.id,
    req.user,
    parsed.status,
    parsed.resolutionSummary
  );

  return sendSuccess(res, updatedQuery, 'Ticket query status updated successfully');
};
