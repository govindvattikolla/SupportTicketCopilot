import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createPublicTicket,
  getTicketByTrackingToken,
  addCustomerMessage,
} from './ticket.service';
import { sendSuccess } from '../../shared/utils/apiResponse';

const createTicketSchema = z.object({
  workspaceSlug: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email address is required'),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  category: z.enum(['technical', 'billing', 'general', 'feature_request', 'bug']).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
});

const addMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(10000),
});

export const submitPublicTicket = async (req: Request, res: Response): Promise<Response> => {
  const dto = createTicketSchema.parse(req.body);
  const { ticket, trackingToken } = await createPublicTicket(dto);

  return sendSuccess(
    res,
    {
      ticketNumber: ticket.ticketNumber,
      trackingToken,
      trackingUrl: `/track/${trackingToken}`,
      status: ticket.status,
      subject: ticket.subject,
      createdAt: ticket.createdAt,
    },
    'Ticket submitted successfully',
    201
  );
};

export const trackPublicTicket = async (req: Request, res: Response): Promise<Response> => {
  const { token } = req.params;
  const { ticket, messages } = await getTicketByTrackingToken(token);

  // Return public view of ticket (without internal notes or internal SLA parameters)
  return sendSuccess(res, {
    ticket: {
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      trackingToken: ticket.trackingToken,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      customer: ticket.customer,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    },
    messages,
  });
};

export const submitCustomerMessage = async (req: Request, res: Response): Promise<Response> => {
  const { token } = req.params;
  const { content } = addMessageSchema.parse(req.body);

  const { message } = await addCustomerMessage(token, content);
  return sendSuccess(res, message, 'Reply sent successfully', 201);
};
