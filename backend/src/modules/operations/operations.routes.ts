import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  getUrgencyRankingHandler,
  getAgentRecommendationsHandler,
  getRecurringIssuesHandler,
  getBottlenecksHandler,
} from './operations.controller';

const router = Router();

// Staff authentication required for all operational endpoints
router.use(authenticate);

// 1. Urgency Ranking: returns attention-scored tickets with factor breakdown and explanation
router.get(
  '/urgency-ranking',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(getUrgencyRankingHandler)
);

// 2. Workload-aware Agent Recommendations for a specific ticket
router.get(
  '/recommendations/:ticketId',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(getAgentRecommendationsHandler)
);

// 3. Recurring Issue Clusters & Potential Incident Detection
router.get(
  '/recurring-issues',
  requireRole(['agent', 'lead', 'admin']),
  asyncHandler(getRecurringIssuesHandler)
);

// 4. Bottleneck Analytics: unassigned, pending customer, engineering, SLA breaches, workload variance
router.get(
  '/bottlenecks',
  requireRole(['lead', 'admin', 'agent']),
  asyncHandler(getBottlenecksHandler)
);

export default router;
