import { Types } from 'mongoose';
import {
  AdminReport,
  IAdminReport,
  AdminReportCategory,
  AdminReportPriority,
  AdminReportStatus,
} from './adminReport.model';
import { Ticket } from '../tickets/ticket.model';
import { AuditEvent } from '../audit/audit.model';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AppError';

export interface CreateAdminReportInput {
  title: string;
  category: AdminReportCategory;
  priority: AdminReportPriority;
  summary: string;
  actionRequired?: string;
  ticketId?: string;
}

export interface ListAdminReportsFilter {
  status?: string;
  priority?: string;
  category?: string;
  leadId?: string;
  page?: number;
  limit?: number;
}

export const createAdminReport = async (
  workspaceId: Types.ObjectId,
  leadUser: { _id: Types.ObjectId; name: string; role: string },
  input: CreateAdminReportInput
): Promise<IAdminReport> => {
  let ticketNumber: string | undefined;
  let ticketObjectId: Types.ObjectId | undefined;

  if (input.ticketId && input.ticketId.trim()) {
    if (!Types.ObjectId.isValid(input.ticketId)) {
      throw new BadRequestError('Invalid ticket ID format');
    }
    const ticket = await Ticket.findOne({
      _id: input.ticketId,
      workspaceId,
    });
    if (ticket) {
      ticketObjectId = ticket._id;
      ticketNumber = ticket.ticketNumber;
    }
  }

  const report = await AdminReport.create({
    workspaceId,
    leadId: leadUser._id,
    leadName: leadUser.name,
    title: input.title.trim(),
    category: input.category,
    priority: input.priority,
    status: 'submitted',
    summary: input.summary.trim(),
    actionRequired: input.actionRequired?.trim(),
    ticketId: ticketObjectId,
    ticketNumber,
    messages: [
      {
        senderId: leadUser._id,
        senderName: leadUser.name,
        senderRole: leadUser.role as 'lead' | 'admin',
        message: input.summary.trim(),
        createdAt: new Date(),
      },
    ],
  });

  await AuditEvent.create({
    ticketId: ticketObjectId,
    workspaceId,
    actor: {
      type: 'user',
      userId: leadUser._id,
      name: leadUser.name,
    },
    action: 'admin_report_created',
    details: {
      reportId: report._id,
      title: report.title,
      category: report.category,
      priority: report.priority,
      ticketNumber: report.ticketNumber,
    },
  });

  return report;
};

export const listAdminReports = async (
  workspaceId: Types.ObjectId,
  _user: { _id: Types.ObjectId; role: string },
  filters: ListAdminReportsFilter
) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const mongoFilter: any = { workspaceId };

  if (filters.leadId && Types.ObjectId.isValid(filters.leadId)) {
    mongoFilter.leadId = new Types.ObjectId(filters.leadId);
  }

  if (filters.status && filters.status !== 'all') {
    mongoFilter.status = filters.status;
  }

  if (filters.priority && filters.priority !== 'all') {
    mongoFilter.priority = filters.priority;
  }

  if (filters.category && filters.category !== 'all') {
    mongoFilter.category = filters.category;
  }

  const [reports, total] = await Promise.all([
    AdminReport.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('ticketId', 'customer subject status priority')
      .lean(),
    AdminReport.countDocuments(mongoFilter),
  ]);

  const [submittedCount, criticalCount, inProgressCount, resolvedCount] = await Promise.all([
    AdminReport.countDocuments({ workspaceId, status: 'submitted' }),
    AdminReport.countDocuments({
      workspaceId,
      priority: 'critical',
      status: { $in: ['submitted', 'in_progress', 'acknowledged'] },
    }),
    AdminReport.countDocuments({
      workspaceId,
      status: { $in: ['acknowledged', 'in_progress'] },
    }),
    AdminReport.countDocuments({ workspaceId, status: { $in: ['resolved', 'closed'] } }),
  ]);

  return {
    reports,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    summary: {
      total,
      submitted: submittedCount,
      critical: criticalCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
    },
  };
};

export const getAdminReportById = async (
  workspaceId: Types.ObjectId,
  reportId: string,
  _user: { _id: Types.ObjectId; role: string }
): Promise<IAdminReport> => {
  if (!Types.ObjectId.isValid(reportId)) {
    throw new BadRequestError('Invalid report ID format');
  }

  const report = await AdminReport.findOne({
    _id: reportId,
    workspaceId,
  }).populate('ticketId', 'customer subject status priority category');

  if (!report) {
    throw new NotFoundError('Admin operational report not found');
  }

  return report;
};

export const addAdminReportMessage = async (
  workspaceId: Types.ObjectId,
  reportId: string,
  currentUser: { _id: Types.ObjectId; name: string; role: string },
  messageText: string
): Promise<IAdminReport> => {
  if (!Types.ObjectId.isValid(reportId)) {
    throw new BadRequestError('Invalid report ID format');
  }

  const report = await AdminReport.findOne({
    _id: reportId,
    workspaceId,
  });

  if (!report) {
    throw new NotFoundError('Admin report not found');
  }

  const trimmed = messageText.trim();
  if (!trimmed) {
    throw new BadRequestError('Message cannot be empty');
  }

  report.messages.push({
    senderId: currentUser._id,
    senderName: currentUser.name,
    senderRole: currentUser.role as 'lead' | 'admin',
    message: trimmed,
    createdAt: new Date(),
  });

  // If admin responds to a submitted report, advance status to in_progress
  if (report.status === 'submitted' && currentUser.role === 'admin') {
    report.status = 'in_progress';
  }

  await report.save();

  await AuditEvent.create({
    ticketId: report.ticketId,
    workspaceId,
    actor: {
      type: 'user',
      userId: currentUser._id,
      name: currentUser.name,
    },
    action: 'admin_report_reply_added',
    details: {
      reportId: report._id,
      title: report.title,
      senderRole: currentUser.role,
    },
  });

  return report;
};

export const updateAdminReportStatus = async (
  workspaceId: Types.ObjectId,
  reportId: string,
  currentUser: { _id: Types.ObjectId; name: string; role: string },
  newStatus: AdminReportStatus,
  adminDirective?: string
): Promise<IAdminReport> => {
  if (!Types.ObjectId.isValid(reportId)) {
    throw new BadRequestError('Invalid report ID format');
  }

  const report = await AdminReport.findOne({
    _id: reportId,
    workspaceId,
  });

  if (!report) {
    throw new NotFoundError('Admin report not found');
  }

  // Only admin or the creating lead can change status
  if (currentUser.role !== 'admin' && report.leadId.toString() !== currentUser._id.toString()) {
    throw new ForbiddenError('You do not have permission to modify this report');
  }

  const previousStatus = report.status;
  report.status = newStatus;

  if (adminDirective) {
    report.adminDirective = adminDirective.trim();
  }

  if (newStatus === 'resolved' || newStatus === 'closed') {
    report.resolvedAt = new Date();
    report.resolvedBy = currentUser._id;
  }

  await report.save();

  await AuditEvent.create({
    ticketId: report.ticketId,
    workspaceId,
    actor: {
      type: 'user',
      userId: currentUser._id,
      name: currentUser.name,
    },
    action: 'admin_report_status_changed',
    details: {
      reportId: report._id,
      title: report.title,
      from: previousStatus,
      to: newStatus,
      adminDirective,
    },
  });

  return report;
};
