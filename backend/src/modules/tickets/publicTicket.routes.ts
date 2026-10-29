import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  submitPublicTicket,
  trackPublicTicket,
  submitCustomerMessage,
} from './publicTicket.controller';
import {
  downloadPublicAttachment,
  uploadPublicAttachment,
} from '../attachments/attachment.controller';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// Rate limiter for public endpoints (prevents spam / brute-force token enumeration)
const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

router.use(publicRateLimiter);

// Public Ticket APIs
router.post('/', asyncHandler(submitPublicTicket));
router.get('/track/:token', asyncHandler(trackPublicTicket));
router.post('/track/:token/messages', asyncHandler(submitCustomerMessage));

// Public Attachment APIs (restricted to matching tracking token/ticket ID)
router.get('/track/:token/attachments/:attachmentId', asyncHandler(downloadPublicAttachment));
router.post('/track/:token/attachments', asyncHandler(uploadPublicAttachment));

export const publicTicketRoutes = router;
