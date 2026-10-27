import crypto from 'crypto';
import { Types } from 'mongoose';
import { Ticket, ITicket, TicketStatus, TicketPriority, TicketCategory } from './ticket.model';
import { Message, IMessage, MessageType } from '../messages/message.model';
import { AuditEvent, IAuditEvent } from '../audit/audit.model';
import { Workspace } from '../workspaces/workspace.model';
import { User } from '../users/user.model';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

// Valid ticket status transitions
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['pending', 'resolved', 'closed'],
  pending: ['in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

export const isValidStatusTransition = (
  currentStatus: TicketStatus,
  targetStatus: TicketStatus
): boolean => {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
};

export interface CreatePublicTicketDTO {
  workspaceSlug?: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}

export const createPublicTicket = async (
  dto: CreatePublicTicketDTO
): Promise<{ ticket: ITicket; trackingToken: string }> => {
  // Determine target workspace (default to first active workspace if slug omitted)
  let workspace;
  if (dto.workspaceSlug) {
    workspace = await Workspace.findOne({ slug: dto.workspaceSlug.toLowerCase().trim() });
  } else {
    workspace = await Workspace.findOne().sort({ createdAt: 1 });
  }

  if (!workspace) {
    throw new NotFoundError('Target workspace not found');
  }

  // Atomically increment ticket counter for human-readable code
  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspace._id,
    { $inc: { ticketCounter: 1 } },
    { new: true }
  );

  const counter = updatedWorkspace ? updatedWorkspace.ticketCounter : 1001;
  const ticketNumber = `TCK-${counter}`;
  const trackingToken = crypto.randomBytes(32).toString('hex');

  const ticket = await Ticket.create({
    workspaceId: workspace._id,
    ticketNumber,
    trackingToken,
    customer: {
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
    },
    subject: dto.subject.trim(),
    description: dto.description.trim(),
    category: dto.category || 'general',
    priority: dto.priority || workspace.settings?.defaultPriority || 'P3',
    status: 'open',
  });

  // Record initial audit event
  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId: workspace._id,
    actor: {
      type: 'customer',
      name: dto.name.trim(),
    },
    action: 'ticket_created',
    details: {
      ticketNumber,
      category: ticket.category,
      priority: ticket.priority,
    },
  });

  return { ticket, trackingToken };
};

export const getTicketByTrackingToken = async (
  trackingToken: string
): Promise<{ ticket: ITicket; messages: IMessage[] }> => {
  const ticket = await Ticket.findOne({ trackingToken });
  if (!ticket) {
    throw new NotFoundError('Invalid tracking token or ticket does not exist');
  }

  // Strictly filter only public customer replies (internal notes are completely excluded)
  const messages = await Message.find({
    ticketId: ticket._id,
    type: 'reply',
  })
    .sort({ createdAt: 1 })
    .select('_id type sender content createdAt');

  return { ticket, messages };
};

export const addCustomerMessage = async (
  trackingToken: string,
  content: string
): Promise<IMessage> => {
  const ticket = await Ticket.findOne({ trackingToken });
  if (!ticket) {
    throw new NotFoundError('Invalid tracking token or ticket does not exist');
  }

  if (!content || !content.trim()) {
    throw new BadRequestError('Message content cannot be empty');
  }

  // Check if ticket was resolved: customer reply may reopen it
  const workspace = await Workspace.findById(ticket.workspaceId);
  const allowReopen = workspace?.settings?.allowCustomerReopen ?? true;

  if (ticket.status === 'resolved' && allowReopen) {
    ticket.status = 'open';
    await ticket.save();

    await AuditEvent.create({
      ticketId: ticket._id,
      workspaceId: ticket.workspaceId,
      actor: {
        type: 'customer',
        name: ticket.customer.name,
      },
      action: 'ticket_reopened_by_customer',
      details: {
        from: 'resolved',
        to: 'open',
        reason: 'Customer follow-up message submitted',
      },
    });
  }

  const message = await Message.create({
    ticketId: ticket._id,
    workspaceId: ticket.workspaceId,
    type: 'reply',
    sender: {
      type: 'customer',
      name: ticket.customer.name,
      email: ticket.customer.email,
    },
    content: content.trim(),
  });

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId: ticket.workspaceId,
    actor: {
      type: 'customer',
      name: ticket.customer.name,
    },
    action: 'reply_added',
    details: { messageId: message._id },
  });

  return message;
};

// Staff Service Methods (Workspace-Scoped)
export interface ListTicketsQuery {
  status?: string;
  priority?: string;
  assignedTo?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'priority' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export const listWorkspaceTickets = async (
  workspaceId: Types.ObjectId,
  query: ListTicketsQuery
): Promise<{
  tickets: ITicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  const filter: any = { workspaceId };

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.priority && query.priority !== 'all') {
    filter.priority = query.priority;
  }
  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }
  if (query.assignedTo) {
    if (query.assignedTo === 'unassigned') {
      filter.assignedTo = { $exists: false };
    } else if (Types.ObjectId.isValid(query.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { ticketNumber: searchRegex },
      { subject: searchRegex },
      { 'customer.name': searchRegex },
      { 'customer.email': searchRegex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 15));
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sort: any = { [sortBy]: sortOrder };

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('assignedTo', '_id name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);

  return {
    tickets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getWorkspaceTicketDetails = async (
  workspaceId: Types.ObjectId,
  ticketId: string
): Promise<{ ticket: ITicket; messages: IMessage[]; auditEvents: IAuditEvent[] }> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  // Strictly enforce workspace isolation
  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId }).populate(
    'assignedTo',
    '_id name email role'
  );

  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  // Staff sees all messages: both public replies and private internal notes
  const [messages, auditEvents] = await Promise.all([
    Message.find({ ticketId: ticket._id, workspaceId }).sort({ createdAt: 1 }),
    AuditEvent.find({ ticketId: ticket._id, workspaceId }).sort({ createdAt: -1 }),
  ]);

  return { ticket, messages, auditEvents };
};

export const updateTicketStatus = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  newStatus: TicketStatus,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  if (!isValidStatusTransition(ticket.status, newStatus)) {
    throw new BadRequestError(
      `Invalid status transition from '${ticket.status}' to '${newStatus}'. Permitted transitions: ${
        VALID_STATUS_TRANSITIONS[ticket.status].join(', ') || 'none'
      }`
    );
  }

  const previousStatus = ticket.status;
  ticket.status = newStatus;

  if (newStatus === 'resolved') {
    ticket.resolvedAt = new Date();
  } else if (newStatus === 'closed') {
    ticket.closedAt = new Date();
  } else if (newStatus === 'open' || newStatus === 'in_progress') {
    // If reopened, clear closure timestamp
    ticket.closedAt = undefined;
  }

  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: 'status_changed',
    details: { from: previousStatus, to: newStatus },
  });

  return ticket;
};

export const updateTicketPriority = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  newPriority: TicketPriority,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  const previousPriority = ticket.priority;
  ticket.priority = newPriority;
  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: 'priority_changed',
    details: { from: previousPriority, to: newPriority },
  });

  return ticket;
};

export const assignTicket = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  assignedToUserId: string | null,
  actor: { userId: Types.ObjectId; name: string }
): Promise<ITicket> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  let assignedUserName = 'Unassigned';

  if (assignedToUserId) {
    if (!Types.ObjectId.isValid(assignedToUserId)) {
      throw new BadRequestError('Invalid agent identifier');
    }

    const assignedUser = await User.findOne({
      _id: assignedToUserId,
      workspaceId,
      isActive: true,
    });

    if (!assignedUser) {
      throw new BadRequestError('Assignee does not exist or is not an active member of this workspace');
    }

    ticket.assignedTo = assignedUser._id;
    assignedUserName = assignedUser.name;
  } else {
    ticket.assignedTo = undefined;
  }

  await ticket.save();

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: assignedToUserId ? 'ticket_assigned' : 'ticket_unassigned',
    details: {
      assignedTo: assignedToUserId,
      assignedToName: assignedUserName,
    },
  });

  return ticket;
};

export const addStaffMessage = async (
  workspaceId: Types.ObjectId,
  ticketId: string,
  type: MessageType,
  content: string,
  actor: { userId: Types.ObjectId; name: string; email: string }
): Promise<IMessage> => {
  if (!Types.ObjectId.isValid(ticketId)) {
    throw new BadRequestError('Invalid ticket identifier');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  if (!content || !content.trim()) {
    throw new BadRequestError('Message content cannot be empty');
  }

  const message = await Message.create({
    ticketId: ticket._id,
    workspaceId,
    type,
    sender: {
      type: 'agent',
      userId: actor.userId,
      name: actor.name,
      email: actor.email,
    },
    content: content.trim(),
  });

  // If this is the first public reply from staff, record firstResponseAt
  if (type === 'reply' && !ticket.firstResponseAt) {
    ticket.firstResponseAt = new Date();
    await ticket.save();
  }

  await AuditEvent.create({
    ticketId: ticket._id,
    workspaceId,
    actor: {
      type: 'user',
      userId: actor.userId,
      name: actor.name,
    },
    action: type === 'reply' ? 'staff_reply_added' : 'internal_note_added',
    details: { messageId: message._id },
  });

  return message;
};
