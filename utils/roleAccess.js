export const ROLE_ACCESS = {
  admin: {
    canViewDiagnosis: true,
    canViewDob: true,
    canEmergencyOverride: true,
    canViewAllPatients: true,
    canViewAllLogs: true,
    canViewRestrictedPatient: true
  },
  doctor: {
    canViewDiagnosis: true,
    canViewDob: true,
    canViewRestrictedPatient: false,
    canEmergencyOverride: true,
    canViewAllPatients: false,
    canViewAllLogs: false,
    canViewAllWardCharts: false
  },
  nurse: {
    canViewDiagnosis: true,
    canViewDob: true,
    canViewRestrictedPatient: false,
    canEmergencyOverride: true,
    canViewAllPatients: false,
    canViewAllLogs: false,
    canViewAllWardCharts: false
  },
  clerk: {
    canViewDiagnosis: false,
    canViewDob: false,
    canViewRestrictedPatient: false,
    canEmergencyOverride: false,
    canViewAllPatients: false,
    canViewAllLogs: false,
    canViewAllWardCharts: false
  }
};

export function canEmergencyOverrideRole(role) {
  return !!ROLE_ACCESS[role]?.canEmergencyOverride;
}

export function canViewAuditLogs(role) {
  return role === 'admin' || role === 'supervisor';
}

export function canAccessChartInWard({ staffRole, staffWardId, patientWardId }) {
  if (!staffRole) return false;
  if (staffRole === 'admin') return true;
  if (staffWardId == null) return false;
  return staffWardId === patientWardId;
}

export function sanitizePatientForRole(patient, role) {
  if (!patient) return patient;
  const safeRole = role || 'clerk';
  const base = { ...patient };

  if (safeRole === 'clerk') {
    return {
      ...base,
      dob: 'Restricted: clinical staff only',
      diagnosis: 'Restricted: clinical staff only'
    };
  }

  if (safeRole === 'doctor' || safeRole === 'nurse' || safeRole === 'admin') {
    return base;
  }

  if (safeRole === 'supervisor') {
    return base;
  }

  return {
    ...base,
    dob: 'Restricted: clinical staff only',
    diagnosis: 'Restricted: clinical staff only'
  };
}
