import { Router } from 'express';
import { login, logout, getCurrentUser, getWorkspaceAgents } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// Public auth endpoints
router.post('/login', asyncHandler(login));
router.post('/logout', logout);

// Protected auth endpoints
router.get('/me', authenticate, asyncHandler(getCurrentUser));
router.get('/agents', authenticate, asyncHandler(getWorkspaceAgents));

export const authRoutes = router;
