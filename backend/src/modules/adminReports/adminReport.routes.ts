import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  handleCreateAdminReport,
  handleListAdminReports,
  handleGetAdminReportById,
  handleAddAdminReportMessage,
  handleUpdateAdminReportStatus,
} from './adminReport.controller';

const router = Router();

// Staff authentication required for all admin report endpoints
router.use(authenticate);

// List reports (accessible to Leads and Admins only)
router.get(
  '/',
  requireRole(['lead', 'admin']),
  asyncHandler(handleListAdminReports)
);

// Submit report to Admin (Leads and Admins)
router.post(
  '/',
  requireRole(['lead', 'admin']),
  asyncHandler(handleCreateAdminReport)
);

// Get report details and thread
router.get(
  '/:id',
  requireRole(['lead', 'admin']),
  asyncHandler(handleGetAdminReportById)
);

// Add message to discussion thread
router.post(
  '/:id/messages',
  requireRole(['lead', 'admin']),
  asyncHandler(handleAddAdminReportMessage)
);

// Update status (Acknowledged, In Progress, Resolved, Closed)
router.patch(
  '/:id/status',
  requireRole(['lead', 'admin']),
  asyncHandler(handleUpdateAdminReportStatus)
);

export default router;
