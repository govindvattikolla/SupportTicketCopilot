import { Router } from 'express';
import { getWorkspaceAuditEvents } from './audit.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Audit history is restricted to Administrators
router.get('/', requireRole(['admin']), asyncHandler(getWorkspaceAuditEvents));

export const auditRoutes = router;
