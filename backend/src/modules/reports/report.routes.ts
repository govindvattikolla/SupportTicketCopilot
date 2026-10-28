import { Router } from 'express';
import {
  getAgentSummaryController,
  getTeamLeadReportController,
  getAdminOverviewController,
} from './report.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// All reporting endpoints require authentication
router.use(authenticate);

// Agent dashboard summary (strictly agent role)
router.get('/agent-summary', requireRole(['agent']), asyncHandler(getAgentSummaryController));

// Team lead dashboard reporting (strictly team lead role)
router.get('/team', requireRole(['lead']), asyncHandler(getTeamLeadReportController));

// Administrator workspace overview (strictly admin role)
router.get('/admin', requireRole(['admin']), asyncHandler(getAdminOverviewController));

export const reportRoutes = router;
