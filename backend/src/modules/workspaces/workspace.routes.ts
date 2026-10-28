import { Router } from 'express';
import { getCurrentWorkspace, updateWorkspaceSettings } from './workspace.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Any authenticated staff member can view their workspace
router.get('/current', asyncHandler(getCurrentWorkspace));

// Only workspace admin can modify workspace settings
router.patch(
  '/current/settings',
  requireRole(['admin']),
  asyncHandler(updateWorkspaceSettings)
);

export const workspaceRoutes = router;
