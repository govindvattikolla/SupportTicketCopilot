import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createAdminReport,
  listAdminReports,
  getAdminReportById,
  addAdminReportMessage,
  updateAdminReportStatus,
} from './adminReport.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

const createAdminReportSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  category: z.enum([
    'incident_escalation',
    'staffing_capacity',
    'policy_compliance',
    'sla_bottleneck',
    'tooling_request',
    'general_update',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(3000),
  actionRequired: z.string().max(1000).optional(),
  ticketId: z.string().optional(),
});

const addMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(3000),
});

const updateStatusSchema = z.object({
  status: z.enum(['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed']),
  adminDirective: z.string().max(2000).optional(),
});

export const handleCreateAdminReport = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = createAdminReportSchema.parse(req.body);
  const report = await createAdminReport(req.workspaceId, req.user, parsed);

  return sendCreated(res, report, 'Operational report submitted to Admin successfully');
};

export const handleListAdminReports = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const { status, priority, category, leadId, page, limit } = req.query;

  const result = await listAdminReports(req.workspaceId, req.user, {
    status: status as string,
    priority: priority as string,
    category: category as string,
    leadId: leadId as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return sendSuccess(res, result, 'Admin operational reports retrieved');
};

export const handleGetAdminReportById = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const report = await getAdminReportById(req.workspaceId, req.params.id, req.user);
  return sendSuccess(res, report, 'Admin report details retrieved');
};

export const handleAddAdminReportMessage = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = addMessageSchema.parse(req.body);
  const updatedReport = await addAdminReportMessage(
    req.workspaceId,
    req.params.id,
    req.user,
    parsed.message
  );

  return sendSuccess(res, updatedReport, 'Message added to admin report discussion');
};

export const handleUpdateAdminReportStatus = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Authentication required');

  const parsed = updateStatusSchema.parse(req.body);
  const updatedReport = await updateAdminReportStatus(
    req.workspaceId,
    req.params.id,
    req.user,
    parsed.status,
    parsed.adminDirective
  );

  return sendSuccess(res, updatedReport, 'Admin report status updated successfully');
};
