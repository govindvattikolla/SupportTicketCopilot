import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, getCurrentUser, getWorkspaceAgents } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// Rate limiter for authentication endpoints to prevent brute-force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
});

// Public auth endpoints
router.post('/login', authRateLimiter, asyncHandler(login));
router.get('/login', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SupportFlow Auth Login Endpoint is ready. To log in with your credentials, use HTTP POST or open the web interface at http://localhost/login.',
  });
});
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

// Protected auth endpoints
router.get('/me', authenticate, asyncHandler(getCurrentUser));
router.get('/agents', authenticate, asyncHandler(getWorkspaceAgents));

export const authRoutes = router;
