import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizePatientForRole,
  canEmergencyOverrideRole,
  canAccessChartInWard,
  canViewAuditLogs
} from '../utils/roleAccess.js';

test('clerks receive limited patient details', () => {
  const patient = {
    id: 'pat-101',
    name: 'Eleanor Vance',
    dob: '1982-04-14',
    diagnosis: 'Acute Appendicitis',
    ward_id: 1,
    ward_name: 'Ward 1'
  };

  const result = sanitizePatientForRole(patient, 'clerk');

  assert.equal(result.dob, 'Restricted: clinical staff only');
  assert.equal(result.diagnosis, 'Restricted: clinical staff only');
  assert.equal(result.name, 'Eleanor Vance');
});

test('clinical and admin roles can authorize emergency overrides', () => {
  assert.equal(canEmergencyOverrideRole('doctor'), true);
  assert.equal(canEmergencyOverrideRole('nurse'), true);
  assert.equal(canEmergencyOverrideRole('admin'), true);
  assert.equal(canEmergencyOverrideRole('clerk'), false);
});

test('ward access is constrained for all roles', () => {
  assert.equal(canAccessChartInWard({ staffRole: 'doctor', staffWardId: 1, patientWardId: 1 }), true);
  assert.equal(canAccessChartInWard({ staffRole: 'doctor', staffWardId: 1, patientWardId: 2 }), false);
  assert.equal(canAccessChartInWard({ staffRole: 'admin', staffWardId: null, patientWardId: 2 }), true);
  assert.equal(canAccessChartInWard({ staffRole: 'clerk', staffWardId: 1, patientWardId: 1 }), true);
});

test('only supervisors and administrators can view audit logs', () => {
  assert.equal(canViewAuditLogs('admin'), true);
  assert.equal(canViewAuditLogs('supervisor'), true);
  assert.equal(canViewAuditLogs('doctor'), false);
  assert.equal(canViewAuditLogs('nurse'), false);
});
