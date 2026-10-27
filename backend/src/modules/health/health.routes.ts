import { Router } from 'express';
import { getHealth } from './health.controller';

const router = Router();

// GET /api/health - Public health check
router.get('/', getHealth);

export const healthRoutes = router;
