import { Router } from 'express';
import {
  getTickets,
  getTicketDetails,
  changeStatus,
  changePriority,
  assignAgent,
  postMessage,
} from './staffTicket.controller';
import {
  downloadStaffAttachment,
  uploadStaffAttachment,
} from '../attachments/attachment.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// Protect all staff ticket routes with authentication & workspace scoping
router.use(authenticate);

router.get('/', asyncHandler(getTickets));
router.get('/:id', asyncHandler(getTicketDetails));
router.patch('/:id/status', asyncHandler(changeStatus));
router.patch('/:id/priority', asyncHandler(changePriority));
router.patch('/:id/assign', asyncHandler(assignAgent));
router.post('/:id/messages', asyncHandler(postMessage));

// Workspace-scoped staff attachment endpoints
router.get('/:id/attachments/:attachmentId', asyncHandler(downloadStaffAttachment));
router.post('/:id/attachments', asyncHandler(uploadStaffAttachment));

export const staffTicketRoutes = router;
