import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  reassignShift,
  anchorNow,
  verifyPatientCredentials,
  deletePatient
} from '../controllers/adminController.js';

const router = express.Router();

// All admin endpoints require JWT authentication and Admin role
router.use(authenticateJWT, requireAdmin);

// POST /admin/reassign-shift - reassign staff member shift immediately
router.post('/reassign-shift', reassignShift);

// POST /admin/anchor-now - create a manual cryptographic snapshot anchor
router.post('/anchor-now', anchorNow);

// GET /admin/patient-credentials - verify required patient identity fields and ward assignment
router.get('/patient-credentials', verifyPatientCredentials);

// DELETE /admin/patients/:id - permanently remove a patient record (audit entry retained)
router.delete('/patients/:id', deletePatient);

export default router;
