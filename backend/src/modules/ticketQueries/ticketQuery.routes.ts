import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  handleCreateTicketQuery,
  handleListTicketQueries,
  handleGetTicketQueryById,
  handleAddTicketQueryMessage,
  handleUpdateTicketQueryStatus,
} from './ticketQuery.controller';

const router = Router();

// Staff authentication required for all query endpoints
router.use(authenticate);

// List queries (Role filtered inside service: agents see own, leads/admins see workspace)
router.get(
  '/',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(handleListTicketQueries)
);

// Create a new query for a ticket
router.post(
  '/',
  requireRole(['agent', 'lead']),
  asyncHandler(handleCreateTicketQuery)
);

// Get query detail and conversation thread
router.get(
  '/:id',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(handleGetTicketQueryById)
);

// Add message to query conversation
router.post(
  '/:id/messages',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(handleAddTicketQueryMessage)
);

// Update status (In Review, Resolved, Closed)
router.patch(
  '/:id/status',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(handleUpdateTicketQueryStatus)
);

export default router;
