import { Ward, Staff, Shift, Patient, AccessLog, ChainAnchor} from '../models/index.js';
import { sequelize } from '../db/index.js';

const databaseDialect = sequelize.getDialect();

/**
 * Health check endpoint
 * GET /api/health
 */
export async function getHealth(req, res) {
  try {
    await sequelize.authenticate();

    res.json({
      status: 'ok',
      database: databaseDialect,
      orm: 'sequelize',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: databaseDialect,
      orm: 'sequelize',
      error: 'Database connection failed',
      details: err.message
    });
  }
}

/**
 * System metadata for UI testing & switcher
 * GET /api/meta
 */
export async function getMeta(req, res) {
  try {
    const wards = await Ward.findAll({ order: [['id', 'ASC']] });

    const staffMembers = await Staff.findAll({
      include: [
        {
          model: Shift,
          as: 'shifts',
          where: { end_time: null },
          required: false,
          include: [{ model: Ward, as: 'ward' }]
        }
      ],
      order: [['name', 'ASC']]
    });

    const staff = staffMembers.map((s) => {
      const activeShift = s.shifts && s.shifts.length > 0 ? s.shifts[0] : null;
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        default_ward: s.default_ward,
        created_at: s.created_at,
        current_ward_id: activeShift ? activeShift.ward_id : null,
        current_ward_name: activeShift?.ward?.name || s.default_ward || 'Unassigned'
      };
    });

    // Custom sorting: admin, doctor, nurse, clerk
    const roleOrder = { admin: 1, doctor: 2, nurse: 3, clerk: 4 };
    staff.sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99) || a.name.localeCompare(b.name));

    const patientCount = await Patient.count();
    const logCount = await AccessLog.count();
    const anchorCount = await ChainAnchor.count();

    const stats = {
      staffCount: staff.length,
      wardCount: wards.length,
      patientCount,
      logCount,
      anchorCount
    };

    const latestAnchor = await ChainAnchor.findOne({ order: [['id', 'DESC']] });
    const latestLog = await AccessLog.findOne({ order: [['id', 'DESC']] });

    return res.json({
      database: 'mysql',
      orm: 'sequelize',
      stats,
      wards: wards.map((w) => w.toJSON()),
      staff,
      latestAnchor: latestAnchor ? latestAnchor.toJSON() : null,
      latestLog: latestLog ? latestLog.toJSON() : null
    });
  } catch (err) {
    console.error('Error fetching meta:', err);
    return res.status(500).json({ error: 'Failed to retrieve system metadata' });
  }
}

/**
 * List all patients across the hospital with ward information
 * GET /api/all-patients
 */
export async function getAllPatients(req, res) {
  try {
    const patients = await Patient.findAll({
      include: [{ model: Ward, as: 'ward' }],
      order: [['ward_id', 'ASC'], ['name', 'ASC']]
    });

    const result = patients.map((p) => {
      const d = p.toJSON();
      return {
        id: d.id,
        name: d.name,
        dob: d.dob,
        ward_id: d.ward_id,
        diagnosis: d.diagnosis,
        admitted_at: d.admitted_at,
        ward_name: d.ward?.name || 'Unknown Ward'
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('Error retrieving all patients:', err);
    return res.status(500).json({ error: 'Failed to fetch patients list' });
  }
}

/**
 * Simulate tampering directly in MySQL for testing verification failure
 * POST /api/test/tamper
 */
export async function tamperLog(req, res) {
  try {
    const { rowId, field = 'reason', newValue = 'UNAUTHORIZED_ALTERATION_BY_ATTACKER' } = req.body || {};

    let targetId = rowId;
    if (!targetId) {
      const lastRow = await AccessLog.findOne({ order: [['id', 'DESC']] });
      if (!lastRow) {
        return res.status(400).json({ error: 'No logs available to tamper with. Generate some activity first.' });
      }
      targetId = lastRow.id;
    }

    const existing = await AccessLog.findByPk(targetId);
    if (!existing) {
      return res.status(404).json({ error: `Log entry with ID ${targetId} not found.` });
    }

    const allowedFields = ['reason', 'action', 'result', 'staff_ward_at_time', 'patient_ward_at_time'];
    const safeField = allowedFields.includes(field) ? field : 'reason';

    // Update directly via raw query to simulate out-of-band attacker SQL tampering without hash recalculation
    await sequelize.query(
      `UPDATE access_logs SET ${safeField} = :val WHERE id = :id`,
      {
        replacements: { val: newValue, id: targetId }
      }
    );

    const updated = await AccessLog.findByPk(targetId);

    return res.json({
      message: `Log row #${targetId} successfully tampered directly in MySQL. Run GET /logs/verify to detect the forgery.`,
      tamperedRowId: targetId,
      fieldModified: safeField,
      originalValue: existing[safeField],
      tamperedValue: newValue,
      row: updated ? updated.toJSON() : null
    });
  } catch (err) {
    console.error('Tamper simulation error:', err);
    return res.status(500).json({ error: 'Tamper simulation failed' });
  }
}

/**
 * Re-seed the database back to clean demo state
 * POST /api/test/reseed
 */
export async function reseedDatabase(req, res) {
  try {
    const { execSync } = await import('child_process');
    execSync('node seed.js', { stdio: 'pipe' });
    return res.json({
      message: 'Database re-seeded successfully with MySQL and Sequelize. 5 wards, 10 staff, and 30 patients restored. Audit logs cleared.'
    });
  } catch (err) {
    console.error('Reseed error:', err);
    return res.status(500).json({ error: 'Failed to reseed database', details: err.message });
  }
}

/**
 * API documentation and endpoints overview
 * GET /api/overview
 */
export function getOverview(req, res) {
  res.json({
    service: 'Hospital Patient-Records Dynamic Access Control System',
    database: 'MySQL (Sequelize ORM)',
    status: 'online',
    version: '2.0.0',
    description: 'Dynamic shift-based access control with emergency override and tamper-evident cryptographic hash-chain audit log.',
    endpoints: {
      auth: {
        login: 'POST /auth/login'
      },
      patients: {
        listInCurrentWard: 'GET /patients',
        getPatientRecord: 'GET /patients/:id',
        emergencyOverride: 'POST /patients/:id/emergency-access'
      },
      logs: {
        getAllLogs: 'GET /logs (Admin only, supports ?limit= & ?offset=)',
        verifyChain: 'GET /logs/verify (Admin only)',
        emergencyOverridesSummary: 'GET /logs/overrides/summary (Admin only)'
      },
      admin: {
        reassignShift: 'POST /admin/reassign-shift (Admin only)',
        anchorNow: 'POST /admin/anchor-now (Admin only)'
      }
    },
    testingCredentials: {
      defaultPassword: 'password123',
      sampleStaff: [
        { id: 'doc-meredith-grey', role: 'doctor', currentWard: 'Ward 1' },
        { id: 'doc-cristina-yang', role: 'doctor', currentWard: 'ICU' },
        { id: 'nurse-jackie-peyton', role: 'nurse', currentWard: 'Ward 2' },
        { id: 'admin-miranda-bailey', role: 'admin', currentWard: 'ICU' }
      ]
    }
  });
}

export default {
  getHealth,
  getMeta,
  getAllPatients,
  tamperLog,
  reseedDatabase,
  getOverview
};
