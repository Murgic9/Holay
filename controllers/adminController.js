import crypto from 'crypto';
import { Ward, Staff, Shift, Patient } from '../models/index.js';
import { sequelize } from '../db/index.js';
import { anchorChain, appendAuditLog } from '../utils/hashChain.js';

/**
 * POST /admin/reassign-shift
 * End current active shift and assign staff member to a new ward.
 */
export async function reassignShift(req, res) {
  try {
    const { staffId, newWardId, wardId } = req.body || {};
    const targetWardId = newWardId !== undefined && newWardId !== null ? newWardId : wardId;

    if (!staffId || targetWardId === undefined || targetWardId === null) {
      return res.status(400).json({ error: 'staffId and newWardId (or wardId) are required' });
    }

    const wardIdNum = parseInt(targetWardId, 10);
    const ward = await Ward.findByPk(wardIdNum);
    if (!ward) {
      return res.status(404).json({ error: `Ward with ID ${targetWardId} not found` });
    }

    const staff = await Staff.findByPk(staffId);
    if (!staff) {
      return res.status(404).json({ error: `Staff member with ID '${staffId}' not found` });
    }

    const now = new Date();
    const newShiftId = crypto.randomUUID();

    const result = await sequelize.transaction(async (t) => {
      // 1. Find currently active shift
      const currentActiveShift = await Shift.findOne({
        where: {
          staff_id: staffId,
          end_time: null
        },
        transaction: t
      });

      // 2. Close active shift
      if (currentActiveShift) {
        await currentActiveShift.update({ end_time: now }, { transaction: t });
      }

      // 3. Create new shift with new ward
      const newShift = await Shift.create({
        id: newShiftId,
        staff_id: staffId,
        ward_id: wardIdNum,
        start_time: now,
        end_time: null
      }, { transaction: t });

      return {
        previousShift: currentActiveShift ? currentActiveShift.toJSON() : null,
        newShift: {
          id: newShiftId,
          staff_id: staffId,
          ward_id: wardIdNum,
          ward_name: ward.name,
          start_time: now.toISOString(),
          end_time: null
        }
      };
    });

    return res.json({
      message: `Staff member ${staff.name} (${staff.id}) reassigned to ${ward.name} immediately.`,
      ...result
    });
  } catch (err) {
    console.error('Error reassigning shift:', err);
    return res.status(500).json({ error: 'Failed to reassign shift' });
  }
}

/**
 * POST /admin/anchor-now
 * Manually trigger hash-chain snapshot anchoring.
 */
export async function anchorNow(req, res) {
  try {
    const anchor = await anchorChain();
    if (!anchor) {
      return res.status(400).json({
        error: 'Cannot anchor: access_logs is currently empty. Perform some access operations first.'
      });
    }

    return res.json({
      message: 'Chain anchor successfully recorded.',
      anchor
    });
  } catch (err) {
    console.error('Error anchoring chain:', err);
    return res.status(500).json({ error: 'Failed to record chain anchor' });
  }
}

export async function verifyPatientCredentials(req, res) {
  try {
    const patientId = req.query.id ? String(req.query.id).trim() : null;
    const patients = await Patient.findAll({
      where: patientId ? { id: patientId } : {},
      include: [{ model: Ward, as: 'ward' }],
      order: [['id', 'ASC']]
    });

    const records = patients.map((patient) => {
      const record = patient.toJSON();
      const missingFields = ['id', 'name', 'dob', 'ward_id', 'diagnosis']
        .filter((field) => record[field] === null || record[field] === undefined || String(record[field]).trim() === '');
      if (!record.ward) missingFields.push('ward');
      return {
        id: record.id,
        name: record.name,
        dob: record.dob,
        diagnosis: record.diagnosis,
        ward_id: record.ward_id,
        ward_name: record.ward?.name || null,
        admitted_at: record.admitted_at,
        verified: missingFields.length === 0,
        missingFields
      };
    });

    return res.json({
      verified: records.every((record) => record.verified),
      total: records.length,
      records
    });
  } catch (err) {
    console.error('Error verifying patient credentials:', err);
    return res.status(500).json({ error: 'Failed to verify patient credentials' });
  }
}

export async function deletePatient(req, res) {
  try {
    const patientId = String(req.params.id || '').trim();
    const patient = await Patient.findByPk(patientId, {
      include: [{ model: Ward, as: 'ward' }]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    const record = patient.toJSON();
    await patient.destroy();
    await appendAuditLog({
      staff_id: req.user.staffId,
      patient_id: record.id,
      action: 'DELETE_RECORD',
      result: 'GRANTED',
      reason: 'Administrator deleted patient record',
      staff_ward_at_time: req.user.role === 'admin' ? 'All wards' : 'Unassigned',
      patient_ward_at_time: record.ward?.name || 'Unknown Ward',
      timestamp: new Date().toISOString()
    });

    return res.json({ message: 'Patient record deleted.', patientId: record.id });
  } catch (err) {
    console.error('Error deleting patient:', err);
    return res.status(500).json({ error: 'Failed to delete patient record' });
  }
}

export default {
  reassignShift,
  anchorNow,
  verifyPatientCredentials,
  deletePatient
};
