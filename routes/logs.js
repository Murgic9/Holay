import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/requireAdmin.js';
import {
  getLogs,
  getEmergencyLogs,
  verifyChainHandler,
  getOverridesSummary
} from '../controllers/logsController.js';

const router = express.Router();

// All logs endpoints require JWT authentication and Supervisor or Admin role
router.use(authenticateJWT, requireSupervisor);

// GET /logs - paginated access logs
router.get('/', getLogs);

// GET /logs/emergency - emergency access events for supervisor review
router.get('/emergency', getEmergencyLogs);

// GET /logs/verify - cryptographic verification of hash chain and anchors
router.get('/verify', verifyChainHandler);

// GET /logs/overrides/summary - aggregated ranking of emergency overrides by staff
router.get('/overrides/summary', getOverridesSummary);

export default router;
