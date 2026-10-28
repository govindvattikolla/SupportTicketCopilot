import { Request, Response } from 'express';
import {
  getAgentDashboardSummary,
  getTeamLeadReport,
  getAdminOverview,
} from './report.service';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError } from '../../shared/errors/AppError';

export const getAgentSummaryController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId || !req.user) {
    throw new UnauthorizedError('Workspace context and user authentication required');
  }

  const summary = await getAgentDashboardSummary(req.workspaceId, req.user._id);
  return sendSuccess(res, summary, 'Agent dashboard summary loaded');
};

export const getTeamLeadReportController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId) {
    throw new UnauthorizedError('Workspace context required');
  }

  const report = await getTeamLeadReport(req.workspaceId);
  return sendSuccess(res, report, 'Team lead report loaded');
};

export const getAdminOverviewController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId) {
    throw new UnauthorizedError('Workspace context required');
  }

  const overview = await getAdminOverview(req.workspaceId);
  return sendSuccess(res, overview, 'Workspace admin overview loaded');
};
