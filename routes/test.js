import express from 'express';
import {
  getHealth,
  getMeta,
  getAllPatients,
  tamperLog,
  reseedDatabase,
  getOverview
} from '../controllers/testController.js';

const router = express.Router();

// GET /api/health - database & Sequelize engine status
router.get('/health', getHealth);

// GET /api/meta - wards, staff and system metrics for UI switcher
router.get('/meta', getMeta);

// GET /api/all-patients - all patients across all wards
router.get('/all-patients', getAllPatients);

// POST /api/test/tamper - simulate row alteration to test chain verification
router.post('/test/tamper', tamperLog);

// POST /api/test/reseed - restore database to initial demo state
router.post('/test/reseed', reseedDatabase);

// GET /api/overview - API documentation overview
router.get('/overview', getOverview);

export default router;
