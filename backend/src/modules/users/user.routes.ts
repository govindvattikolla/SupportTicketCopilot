import { Router } from 'express';
import {
  getWorkspaceUsers,
  createWorkspaceUser,
  updateWorkspaceUser,
} from './user.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Team Leads and Admins can view full user roster
router.get('/', requireRole(['admin', 'lead']), asyncHandler(getWorkspaceUsers));

// Only Admins can create new users or modify existing user accounts
router.post('/', requireRole(['admin']), asyncHandler(createWorkspaceUser));
router.patch('/:id', requireRole(['admin']), asyncHandler(updateWorkspaceUser));

export const userRoutes = router;
