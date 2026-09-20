const API_URL = window.HOLAY_API_URL || window.location.origin;

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('hospitalSession') || 'null'); } catch { return null; }
}

function saveSession(data) { sessionStorage.setItem('hospitalSession', JSON.stringify(data)); }
function clearSession() { sessionStorage.removeItem('hospitalSession'); }
function authHeaders() { const session = getSession(); return session?.token ? { Authorization: `Bearer ${session.token}` } : {}; }

async function apiFetch(path, options = {}) {
  const headers = { ...authHeaders(), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
function formatDate(value) { if (!value) return 'Unknown'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
function showMessage(id, message) { const element = document.getElementById(id); if (element) element.textContent = message; }
function redirectForSession() { const session = getSession(); if (!session) { window.location.href = './index.html'; return null; } return session; }
function setupCommon(session) { document.querySelectorAll('#staff-chip').forEach((element) => { element.textContent = `${session.staff.name} · ${session.staff.role}`; }); document.getElementById('logout-button')?.addEventListener('click', () => { clearSession(); window.location.href = './index.html'; }); }

function initLogin() {
  let selectedRole = 'staff';
  const loginForm = document.getElementById('login-form');
  loginForm?.reset();
  document.querySelectorAll('.role-button').forEach((button) => button.addEventListener('click', () => { selectedRole = button.dataset.role; document.querySelectorAll('.role-button').forEach((item) => item.classList.toggle('active', item === button)); }));
  document.getElementById('toggle-password')?.addEventListener('click', (event) => { const password = document.getElementById('password'); const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; event.currentTarget.textContent = visible ? '◉' : '○'; event.currentTarget.setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); event.currentTarget.setAttribute('title', visible ? 'Show password' : 'Hide password'); });
  document.querySelectorAll('[data-demo-id]').forEach((button) => button.addEventListener('click', () => { document.getElementById('staff-id').value = button.dataset.demoId; document.getElementById('password').value = button.dataset.demoPassword || ''; selectedRole = button.dataset.demoRole; document.querySelectorAll('.role-button').forEach((item) => item.classList.toggle('active', item.dataset.role === selectedRole)); }));
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Checking...'; showMessage('login-message', ''); showMessage('login-success', '');
    try {
      const result = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ staffId: form.get('staffId').trim(), password: form.get('password') }) });
      if (selectedRole === 'supervisor' && result.staff.role !== 'admin') throw new Error('This account is not a supervisor account.');
      showMessage('login-success', '✓ Password confirmed. Signing you in...'); saveSession(result); window.location.replace(selectedRole === 'supervisor' ? './supervisor.html' : './dashboard.html');
    } catch (error) { showMessage('login-message', error.message || 'Could not sign in. Check your connection and details.'); button.disabled = false; button.innerHTML = 'Login <span class="check-icon" aria-hidden="true">✓</span>'; }
  });
}

let dashboardPatients = [];
function patientCard(patient) { return `<a class="patient-card" href="./patient.html?id=${encodeURIComponent(patient.id)}"><div><h3>${escapeHtml(patient.name)}</h3><div class="patient-meta">Card ${escapeHtml(patient.id)} · ${escapeHtml(patient.ward_name || 'Ward')}</div></div><span class="patient-arrow" aria-hidden="true">→</span></a>`; }
function renderPatients(query = '') { const normalized = query.trim().toLowerCase(); const cardAlias = normalized.match(/^car-(\d+)$/)?.[1]; const visible = dashboardPatients.filter((patient) => { const searchable = `${patient.name} ${patient.id}`.toLowerCase(); return searchable.includes(normalized) || (cardAlias && searchable.includes(`pat-${cardAlias}`)); }); const list = document.getElementById('patient-list'); document.getElementById('patient-count').textContent = `${visible.length} patient${visible.length === 1 ? '' : 's'}`; list.innerHTML = visible.length ? visible.map(patientCard).join('') : '<div class="loading-state">No patients found. Try a different name or card number.</div>'; }

async function initDashboard(session) {
  setupCommon(session); document.getElementById('staff-name').textContent = session.staff.name.split(' ')[0];
  document.getElementById('patient-search').addEventListener('input', (event) => renderPatients(event.target.value)); document.getElementById('clear-search').addEventListener('click', () => { document.getElementById('patient-search').value = ''; renderPatients(); });
  try { dashboardPatients = await apiFetch('/patients'); cachePatients(dashboardPatients); renderPatients(); } catch (error) { dashboardPatients = readCachedPatients(); renderPatients(); if (!dashboardPatients.length) document.getElementById('patient-list').innerHTML = `<div class="loading-state">${escapeHtml(error.message)}<br>Patient records will appear when the connection returns.</div>`; }
  const patientModal = document.getElementById('patient-modal');
  const openPatientModal = () => { patientModal.hidden = false; document.getElementById('new-patient-id').focus(); };
  document.getElementById('add-patient-button').addEventListener('click', openPatientModal);
  document.querySelector('.brand-mark')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openPatientModal(); });
  document.getElementById('cancel-patient').addEventListener('click', () => { patientModal.hidden = true; });
  document.getElementById('patient-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById('patient-form-message');
    message.textContent = '';
    try {
      const patient = await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify({
          id: document.getElementById('new-patient-id').value.trim(),
          name: document.getElementById('new-patient-name').value.trim(),
          dob: document.getElementById('new-patient-dob').value,
          diagnosis: document.getElementById('new-patient-diagnosis').value.trim(),
          ward_id: session.staff.currentShiftWardId
        })
      });
      dashboardPatients = [...dashboardPatients, patient].sort((a, b) => a.name.localeCompare(b.name));
      cachePatients(dashboardPatients); renderPatients(); form.reset(); patientModal.hidden = true;
    } catch (error) { message.textContent = error.message || 'Could not add this record.'; }
  });
  const emergencyModal = document.getElementById('emergency-modal');
  document.getElementById('emergency-button').addEventListener('click', () => { emergencyModal.hidden = false; document.getElementById('emergency-patient').focus(); });
  document.getElementById('cancel-emergency').addEventListener('click', () => { emergencyModal.hidden = true; });
  document.getElementById('emergency-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const patientId = document.getElementById('emergency-patient').value.trim(); const reason = document.getElementById('emergency-reason').value.trim(); if (!patientId || !reason) return;
    emergencyModal.hidden = true;
    if (!navigator.onLine) { queueAuditIntent({ type: 'emergency', patientId, reason: reason.trim() }); alert('Offline. Emergency access has been queued and will sync when back online.'); return; }
    try { await apiFetch(`/patients/${encodeURIComponent(patientId.trim())}/emergency-access`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }); alert('Emergency access recorded. Supervisor will be notified.'); } catch (error) { alert(error.message); }
    form.reset();
  });
}

async function initPatient(session) {
  setupCommon(session); const patientId = new URLSearchParams(window.location.search).get('id'); const content = document.getElementById('patient-content'); if (!patientId) { content.innerHTML = '<div class="loading-state">No patient was selected.</div>'; return; }
  try { const patient = await apiFetch(`/patients/${encodeURIComponent(patientId)}`); renderPatient(patient, false); } catch (error) { const cached = readCachedPatients().find((patient) => patient.id === patientId); if (cached) { queueAuditIntent({ type: 'view', patientId }); renderPatient(cached, true); } else content.innerHTML = `<div class="loading-state">${escapeHtml(error.message)}</div>`; }
}
function renderPatient(patient, offline) { document.getElementById('patient-content').innerHTML = `<div class="record-top"><div><p class="eyebrow">Patient record</p><h1>${escapeHtml(patient.name)}</h1><p class="record-id">Card number: ${escapeHtml(patient.id)}</p></div><span class="${offline ? 'offline-tag' : 'online-tag'}">${offline ? 'Offline view' : 'Access recorded'}</span></div><div class="record-grid"><div><span class="detail-label">Date of birth</span><span class="detail-value">${escapeHtml(patient.dob)}</span></div><div><span class="detail-label">Ward</span><span class="detail-value">${escapeHtml(patient.ward_name)}</span></div><div><span class="detail-label">Diagnosis</span><span class="detail-value">${escapeHtml(patient.diagnosis)}</span></div><div><span class="detail-label">Admitted</span><span class="detail-value">${escapeHtml(formatDate(patient.admitted_at))}</span></div></div><div class="read-only-note">Read-only record. This visit is part of the hospital audit trail.</div>`; }

let allLogs = [];
function logRow(log, offline = false) { const action = (log.action || 'UNKNOWN').toLowerCase(); return `<tr><td>${escapeHtml(formatDate(log.timestamp))}</td><td>${escapeHtml(log.staff_id)}</td><td>${escapeHtml(log.patient_id || '—')}</td><td><span class="log-action ${action}">${escapeHtml(log.action)}</span>${log.reason ? `<br><small>${escapeHtml(log.reason)}</small>` : ''}</td><td>${offline ? '<span class="offline-tag">Offline</span>' : '<span class="online-tag">Online</span>'}</td></tr>`; }
function renderLogs(query = '') { const term = query.toLowerCase().trim(); const filtered = allLogs.filter((log) => `${log.staff_id} ${log.patient_id} ${log.action} ${log.reason || ''}`.toLowerCase().includes(term)); document.getElementById('access-logs').innerHTML = filtered.length ? filtered.map((log) => logRow(log)).join('') : '<tr><td colspan="5" class="empty-cell">No matching access logs.</td></tr>'; const emergency = filtered.filter((log) => log.action === 'EMERGENCY_ACCESS'); document.getElementById('emergency-logs').innerHTML = emergency.length ? emergency.map((log) => `<tr><td>${escapeHtml(formatDate(log.timestamp))}</td><td>${escapeHtml(log.staff_id)}</td><td>${escapeHtml(log.patient_id)}</td><td>${escapeHtml(log.reason || 'No reason provided')}</td><td><span class="immutable-tag">Immutable</span></td></tr>`).join('') : '<tr><td colspan="5" class="empty-cell">No emergency alerts found.</td></tr>'; }
async function initSupervisor(session) { setupCommon(session); if (session.staff.role !== 'admin') { document.querySelector('main').innerHTML = '<div class="loading-state">Supervisor access is restricted to administrator accounts.</div>'; return; } try { const result = await apiFetch('/logs?limit=500'); allLogs = result.logs || []; renderLogs(); } catch (error) { document.getElementById('access-logs').innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(error.message)}</td></tr>`; document.getElementById('emergency-logs').innerHTML = '<tr><td colspan="5" class="empty-cell">Audit data requires an online connection.</td></tr>'; } document.getElementById('log-search').addEventListener('input', (event) => renderLogs(event.target.value)); document.getElementById('export-csv').addEventListener('click', exportCsv); document.getElementById('export-pdf').addEventListener('click', () => window.print()); }
function exportCsv() { const rows = [['Time', 'Who', 'Patient', 'Action', 'Reason', 'Result'], ...allLogs.map((log) => [log.timestamp, log.staff_id, log.patient_id || '', log.action, log.reason || '', log.result])]; const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'hospital-access-log.csv'; link.click(); URL.revokeObjectURL(link.href); }

const session = getSession(); const page = document.body.dataset.page; if (page && !session) redirectForSession(); else if (!page) initLogin(); else if (page === 'dashboard') initDashboard(session); else if (page === 'patient') initPatient(session); else if (page === 'supervisor') initSupervisor(session);
