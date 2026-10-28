import { Types } from 'mongoose';
import { TicketQuery, ITicketQuery, TicketQueryCategory, TicketQueryUrgency, TicketQueryStatus } from './ticketQuery.model';
import { Ticket } from '../tickets/ticket.model';
import { User } from '../users/user.model';
import { AuditEvent } from '../audit/audit.model';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AppError';

export interface CreateTicketQueryInput {
  ticketId: string;
  subject: string;
  category: TicketQueryCategory;
  urgency: TicketQueryUrgency;
  message: string;
  leadId?: string;
}

export interface ListTicketQueriesFilter {
  status?: string;
  urgency?: string;
  category?: string;
  ticketId?: string;
  agentId?: string;
  page?: number;
  limit?: number;
}

export const createTicketQuery = async (
  workspaceId: Types.ObjectId,
  currentUser: { _id: Types.ObjectId; name: string; role: string },
  input: CreateTicketQueryInput
): Promise<ITicketQuery> => {
  if (!Types.ObjectId.isValid(input.ticketId)) {
    throw new BadRequestError('Invalid ticket ID format');
  }

  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    workspaceId,
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  let leadName: string | undefined;
  let leadObjectId: Types.ObjectId | undefined;

  if (input.leadId && Types.ObjectId.isValid(input.leadId)) {
    const lead = await User.findOne({
      _id: input.leadId,
      workspaceId,
      role: { $in: ['lead', 'admin'] },
    });
    if (lead) {
      leadObjectId = lead._id;
      leadName = lead.name;
    }
  }

  const query = await TicketQuery.create({
    workspaceId,
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    agentId: currentUser._id,
    agentName: currentUser.name,
    leadId: leadObjectId,
    leadName,
    subject: input.subject.trim(),
    category: input.category,
    urgency: input.urgency,
    status: 'open',
    messages: [
      {
        senderId: currentUser._id,
        senderName: currentUser.name,
        senderRole: currentUser.role as 'agent' | 'lead' | 'admin',
        message: input.message.trim(),
        createdAt: new Date(),
      },
    ],
  });

  // Log in workspace audit trail
  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: currentUser._id,
      name: currentUser.name,
    },
    action: 'ticket_query_created',
    details: {
      queryId: query._id,
      ticketNumber: ticket.ticketNumber,
      subject: query.subject,
      category: query.category,
      urgency: query.urgency,
    },
  });

  return query;
};

export const listTicketQueries = async (
  workspaceId: Types.ObjectId,
  currentUser: { _id: Types.ObjectId; role: string },
  filters: ListTicketQueriesFilter
) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const mongoFilter: any = { workspaceId };

  // Agent role only sees their own queries unless filtering by a specific ticket
  if (currentUser.role === 'agent' && !filters.ticketId) {
    mongoFilter.agentId = currentUser._id;
  } else if (filters.agentId && Types.ObjectId.isValid(filters.agentId)) {
    mongoFilter.agentId = new Types.ObjectId(filters.agentId);
  }

  if (filters.ticketId && Types.ObjectId.isValid(filters.ticketId)) {
    mongoFilter.ticketId = new Types.ObjectId(filters.ticketId);
  }

  if (filters.status && filters.status !== 'all') {
    mongoFilter.status = filters.status;
  }

  if (filters.urgency && filters.urgency !== 'all') {
    mongoFilter.urgency = filters.urgency;
  }

  if (filters.category && filters.category !== 'all') {
    mongoFilter.category = filters.category;
  }

  const [queries, total] = await Promise.all([
    TicketQuery.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('ticketId', 'customer subject status priority category')
      .lean(),
    TicketQuery.countDocuments(mongoFilter),
  ]);

  // Compute summary stats for the user's scope
  const statsFilter: any = { workspaceId };
  if (currentUser.role === 'agent') {
    statsFilter.agentId = currentUser._id;
  }

  const [openCount, inReviewCount, resolvedCount, urgentCount] = await Promise.all([
    TicketQuery.countDocuments({ ...statsFilter, status: 'open' }),
    TicketQuery.countDocuments({ ...statsFilter, status: 'in_review' }),
    TicketQuery.countDocuments({ ...statsFilter, status: 'resolved' }),
    TicketQuery.countDocuments({
      ...statsFilter,
      urgency: { $in: ['high', 'urgent'] },
      status: { $in: ['open', 'in_review'] },
    }),
  ]);

  return {
    queries,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    summary: {
      total,
      open: openCount,
      inReview: inReviewCount,
      resolved: resolvedCount,
      urgent: urgentCount,
    },
  };
};

export const getTicketQueryById = async (
  workspaceId: Types.ObjectId,
  queryId: string,
  currentUser: { _id: Types.ObjectId; role: string }
): Promise<ITicketQuery> => {
  if (!Types.ObjectId.isValid(queryId)) {
    throw new BadRequestError('Invalid query ID format');
  }

  const query = await TicketQuery.findOne({
    _id: queryId,
    workspaceId,
  }).populate('ticketId', 'customer subject status priority category');

  if (!query) {
    throw new NotFoundError('Ticket query not found');
  }

  // Agent can only access their own query
  if (currentUser.role === 'agent' && query.agentId.toString() !== currentUser._id.toString()) {
    throw new ForbiddenError('You do not have permission to view this query');
  }

  return query;
};

export const addTicketQueryMessage = async (
  workspaceId: Types.ObjectId,
  queryId: string,
  currentUser: { _id: Types.ObjectId; name: string; role: string },
  messageText: string
): Promise<ITicketQuery> => {
  if (!Types.ObjectId.isValid(queryId)) {
    throw new BadRequestError('Invalid query ID format');
  }

  const query = await TicketQuery.findOne({
    _id: queryId,
    workspaceId,
  });

  if (!query) {
    throw new NotFoundError('Ticket query not found');
  }

  if (currentUser.role === 'agent' && query.agentId.toString() !== currentUser._id.toString()) {
    throw new ForbiddenError('You do not have permission to update this query');
  }

  const trimmed = messageText.trim();
  if (!trimmed) {
    throw new BadRequestError('Message cannot be empty');
  }

  query.messages.push({
    senderId: currentUser._id,
    senderName: currentUser.name,
    senderRole: currentUser.role as 'agent' | 'lead' | 'admin',
    message: trimmed,
    createdAt: new Date(),
  });

  // If a lead or admin responds to an open query, advance status to in_review
  if (query.status === 'open' && (currentUser.role === 'lead' || currentUser.role === 'admin')) {
    query.status = 'in_review';
    if (!query.leadId) {
      query.leadId = currentUser._id;
      query.leadName = currentUser.name;
    }
  }

  await query.save();

  await AuditEvent.create({
    ticketId: query.ticketId,
    workspaceId,
    actor: {
      type: 'user',
      userId: currentUser._id,
      name: currentUser.name,
    },
    action: 'ticket_query_reply_added',
    details: {
      queryId: query._id,
      ticketNumber: query.ticketNumber,
      senderRole: currentUser.role,
    },
  });

  return query;
};

export const updateTicketQueryStatus = async (
  workspaceId: Types.ObjectId,
  queryId: string,
  currentUser: { _id: Types.ObjectId; name: string; role: string },
  newStatus: TicketQueryStatus,
  resolutionSummary?: string
): Promise<ITicketQuery> => {
  if (!Types.ObjectId.isValid(queryId)) {
    throw new BadRequestError('Invalid query ID format');
  }

  const query = await TicketQuery.findOne({
    _id: queryId,
    workspaceId,
  });

  if (!query) {
    throw new NotFoundError('Ticket query not found');
  }

  // Agents can only close their own resolved query
  if (currentUser.role === 'agent') {
    if (query.agentId.toString() !== currentUser._id.toString()) {
      throw new ForbiddenError('You do not have permission to modify this query');
    }
    if (newStatus !== 'closed' && newStatus !== 'resolved') {
      throw new ForbiddenError('Agents can only resolve or close their query');
    }
  }

  const previousStatus = query.status;
  query.status = newStatus;

  if (resolutionSummary) {
    query.resolutionSummary = resolutionSummary.trim();
  }

  if (newStatus === 'resolved') {
    query.resolvedAt = new Date();
    query.resolvedBy = currentUser._id;
    if (currentUser.role === 'lead' || currentUser.role === 'admin') {
      query.leadId = currentUser._id;
      query.leadName = currentUser.name;
    }
  }

  await query.save();

  await AuditEvent.create({
    ticketId: query.ticketId,
    workspaceId,
    actor: {
      type: 'user',
      userId: currentUser._id,
      name: currentUser.name,
    },
    action: 'ticket_query_status_changed',
    details: {
      queryId: query._id,
      ticketNumber: query.ticketNumber,
      from: previousStatus,
      to: newStatus,
      resolutionSummary,
    },
  });

  return query;
};
