import { Router } from 'express';
import {
  getCurrentWorkspace,
  updateWorkspaceSettings,
  getWorkspaceSLASettings,
  updateWorkspaceSLASettings,
} from './workspace.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Any authenticated staff member can view their workspace and SLA policy
router.get('/current', asyncHandler(getCurrentWorkspace));
router.get('/current/sla', asyncHandler(getWorkspaceSLASettings));

// Only workspace admin can modify workspace settings and SLA policies
router.patch(
  '/current/settings',
  requireRole(['admin']),
  asyncHandler(updateWorkspaceSettings)
);

router.patch(
  '/current/sla',
  requireRole(['admin']),
  asyncHandler(updateWorkspaceSLASettings)
);

export const workspaceRoutes = router;
