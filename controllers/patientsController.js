import { Patient, Ward, Shift, Staff } from '../models/index.js';
import { appendAuditLog } from '../utils/hashChain.js';
import { sendEmergencyAlert } from '../utils/email.js';
import { canAccessChartInWard, canEmergencyOverrideRole, sanitizePatientForRole } from '../utils/roleAccess.js';

/**
 * Helper to fetch staff's currently active shift (end_time IS NULL)
 */
export async function getActiveShiftForStaff(staffId) {
  const shift = await Shift.findOne({
    where: {
      staff_id: staffId,
      end_time: null
    },
    include: [{ model: Ward, as: 'ward' }]
  });

  if (!shift) return null;

  return {
    shift_id: shift.id,
    ward_id: shift.ward_id,
    ward_name: shift.ward?.name || 'Unknown Ward'
  };
}

function normalizePatientId(patientId) {
  const value = String(patientId || '').trim();
  const carNumber = value.match(/^car-(\d+)$/i);
  return carNumber ? `pat-${carNumber[1]}` : value;
}

/**
 * Helper to fetch patient with ward details
 */
export async function getPatientWithWard(patientId) {
  const patient = await Patient.findByPk(normalizePatientId(patientId), {
    include: [{ model: Ward, as: 'ward' }]
  });

  if (!patient) return null;

  const data = patient.toJSON();
  return {
    id: data.id,
    name: data.name,
    dob: data.dob,
    ward_id: data.ward_id,
    diagnosis: data.diagnosis,
    admitted_at: data.admitted_at,
    ward_name: data.ward?.name || 'Unknown Ward'
  };
}

/**
 * GET /patients
 * List patients in the staff member's current active shift ward.
 */
export async function listPatients(req, res) {
  try {
    const staffId = req.user.staffId;
    const role = req.user.role || 'clerk';
    const activeShift = await getActiveShiftForStaff(staffId);

    const isAdmin = role === 'admin';

    if (!activeShift && !isAdmin) {
      return res.json([]);
    }

    const patients = await Patient.findAll({
      where: {},
      include: [{ model: Ward, as: 'ward' }],
      order: [['name', 'ASC']]
    });

    const result = patients.map((p) => {
      const data = p.toJSON();
      return sanitizePatientForRole({
        id: data.id,
        name: data.name,
        dob: data.dob,
        ward_id: data.ward_id,
        diagnosis: data.diagnosis,
        admitted_at: data.admitted_at,
        ward_name: data.ward?.name || 'Unknown Ward'
      }, role);
    });

    return res.json(result);
  } catch (err) {
    console.error('Error fetching patients:', err);
    return res.status(500).json({ error: 'Failed to retrieve patients' });
  }
}

export async function createPatient(req, res) {
  try {
    const role = req.user.role || 'clerk';
    if (!['admin', 'doctor', 'nurse'].includes(role)) {
      return res.status(403).json({ error: 'Only nurses, doctors, and administrators can add patient records.' });
    }

    const { id, name, dob, ward_id, diagnosis, admitted_at } = req.body || {};
    const patientId = String(id ?? '').trim();
    const patientName = String(name ?? '').trim();
    const patientDiagnosis = String(diagnosis ?? '').trim();
    if (!patientId || !patientName || !dob || ward_id === undefined || !patientDiagnosis) {
      return res.status(400).json({ error: 'id, name, dob, ward_id, and diagnosis are required' });
    }

    const wardId = Number.parseInt(ward_id, 10);
    if (!Number.isInteger(wardId)) {
      return res.status(400).json({ error: 'ward_id must be a valid number' });
    }

    const ward = await Ward.findByPk(wardId);
    if (!ward) return res.status(404).json({ error: `Ward with ID ${wardId} not found` });

    const activeShift = await getActiveShiftForStaff(req.user.staffId);
    if (role !== 'admin' && (!activeShift || activeShift.ward_id !== wardId)) {
      return res.status(403).json({ error: 'You can only add patients to your active ward.' });
    }

    const patient = await Patient.create({
      id: patientId,
      name: patientName,
      dob,
      ward_id: wardId,
      diagnosis: patientDiagnosis,
      admitted_at: admitted_at || new Date()
    });

    return res.status(201).json(await getPatientWithWard(patient.id));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A patient with this card number already exists.' });
    }
    console.error('Error creating patient:', err);
    return res.status(500).json({ error: 'Failed to create patient record' });
  }
}

/**
 * GET /patients/:id
 * Retrieve a specific patient record if staff is assigned to that patient's ward.
 */
export async function getPatientById(req, res) {
  try {
    const staffId = req.user.staffId;
    const patientId = req.params.id;
    const role = req.user.role || 'clerk';

    const patient = await getPatientWithWard(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    const activeShift = await getActiveShiftForStaff(staffId);
    const staffWardName = activeShift ? activeShift.ward_name : 'Unassigned';
    const staffWardId = activeShift ? activeShift.ward_id : null;
    const patientWardName = patient.ward_name;
    const canAccess = true;

    if (canAccess) {
      await appendAuditLog({
        staff_id: staffId,
        patient_id: patient.id,
        action: 'VIEW_RECORD',
        result: 'GRANTED',
        reason: null,
        staff_ward_at_time: staffWardName,
        patient_ward_at_time: patientWardName,
        timestamp: new Date().toISOString()
      });

      return res.json(sanitizePatientForRole(patient, role));
    } else {
      await appendAuditLog({
        staff_id: staffId,
        patient_id: patient.id,
        action: 'DENIED',
        result: 'DENIED',
        reason: null,
        staff_ward_at_time: staffWardName,
        patient_ward_at_time: patientWardName,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        error: "You are not currently assigned to this patient's ward.",
        details: {
          staffCurrentWard: staffWardName,
          patientWard: patientWardName
        }
      });
    }
  } catch (err) {
    console.error('Error viewing patient:', err);
    return res.status(500).json({ error: 'Internal server error while viewing patient record' });
  }
}

/**
 * POST /patients/:id/emergency-access
 * Force emergency access to any patient's record, requiring a typed reason.
 */
export async function emergencyAccess(req, res) {
  try {
    const staffId = req.user.staffId;
    const patientId = req.params.id;
    const role = req.user.role || 'clerk';
    const { reason } = req.body || {};

    if (!canEmergencyOverrideRole(role)) {
      return res.status(403).json({
        error: 'Emergency override is restricted to doctors, nurses, and administrators.'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({
        error: 'Emergency access requires a mandatory, non-empty reason.'
      });
    }

    const patient = await getPatientWithWard(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    const admins = await Staff.findAll({
      where: { role: 'admin' },
      attributes: ['email']
    });
    const adminEmails = admins.map((admin) => admin.email).filter(Boolean);

    const activeShift = await getActiveShiftForStaff(staffId);
    const staffWardName = activeShift ? activeShift.ward_name : 'Unassigned';
    const patientWardName = patient.ward_name;

    await appendAuditLog({
      staff_id: staffId,
      patient_id: patient.id,
      action: 'EMERGENCY_ACCESS',
      result: 'GRANTED',
      reason: reason.trim(),
      staff_ward_at_time: staffWardName,
      patient_ward_at_time: patientWardName,
      timestamp: new Date().toISOString()
    });

    try {
      await sendEmergencyAlert({
        staffId,
        recipientEmails: adminEmails,
        role,
        patient,
        reason: reason.trim()
      });
    } catch (emailError) {
      console.error('Emergency email delivery failed:', emailError);
    }

    return res.json({
      message: 'Emergency override access granted.',
      accessType: 'EMERGENCY_OVERRIDE',
      patient: sanitizePatientForRole(patient, role)
    });
  } catch (err) {
    console.error('Error granting emergency access:', err);
    return res.status(500).json({ error: 'Failed to execute emergency override' });
  }
}

export default {
  getActiveShiftForStaff,
  getPatientWithWard,
  listPatients,
  createPatient,
  getPatientById,
  emergencyAccess
};
