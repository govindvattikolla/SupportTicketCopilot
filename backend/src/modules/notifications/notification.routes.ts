import { Router } from 'express';
import {
  handleGetNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
} from './notification.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(handleGetNotifications));
router.patch('/read-all', asyncHandler(handleMarkAllNotificationsRead));
router.patch('/:id/read', asyncHandler(handleMarkNotificationRead));

export default router;
