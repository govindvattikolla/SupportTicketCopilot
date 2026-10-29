import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from './health.controller';

const router = Router();

// Full system health diagnostics
router.get('/', getHealth);

// Container orchestrator liveness probe (K8s livenessProbe)
router.get('/live', getLiveness);

// Container orchestrator readiness probe (K8s readinessProbe)
router.get('/ready', getReadiness);

export const healthRoutes = router;
