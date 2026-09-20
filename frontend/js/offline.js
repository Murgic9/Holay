const OFFLINE_LOGS_KEY = 'offlineLogs';
const PATIENT_CACHE_KEY = 'hospitalPatientsCache';

function readOfflineLogs() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_LOGS_KEY) || '[]'); } catch { return []; }
}

function writeOfflineLogs(logs) {
  localStorage.setItem(OFFLINE_LOGS_KEY, JSON.stringify(logs));
}

function queueAuditIntent(intent) {
  const logs = readOfflineLogs();
  logs.push({ ...intent, queuedAt: new Date().toISOString() });
  writeOfflineLogs(logs);
  updateOfflineUI();
}

function cachePatients(patients) {
  localStorage.setItem(PATIENT_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), patients }));
}

function readCachedPatients() {
  try { return JSON.parse(localStorage.getItem(PATIENT_CACHE_KEY) || '{}').patients || []; } catch { return []; }
}

async function syncQueuedLogs() {
  const queued = readOfflineLogs();
  if (!navigator.onLine || queued.length === 0) { updateOfflineUI(); return; }
  setOfflineBanner('Back Online - Syncing', true);
  const remaining = [];
  for (const intent of queued) {
    try {
      if (intent.type === 'emergency') {
        await apiFetch(`/patients/${encodeURIComponent(intent.patientId)}/emergency-access`, { method: 'POST', body: JSON.stringify({ reason: intent.reason }) });
      } else {
        await apiFetch(`/patients/${encodeURIComponent(intent.patientId)}`);
      }
    } catch { remaining.push(intent); }
  }
  writeOfflineLogs(remaining);
  updateOfflineUI();
}

function setOfflineBanner(message, syncing = false) {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.toggle('visible', Boolean(message));
  banner.classList.toggle('syncing', syncing);
}

function updateOfflineUI() {
  const queued = readOfflineLogs().length;
  const status = document.getElementById('sync-status');
  if (status) status.innerHTML = `<span class="status-dot"></span><span>${queued ? `Queued (${queued})` : 'Synced'}</span>`;
  if (!navigator.onLine) setOfflineBanner(`Offline - Logs queued locally${queued ? ` (${queued})` : ''}`);
  else if (!queued) setOfflineBanner('');
}

window.addEventListener('online', syncQueuedLogs);
window.addEventListener('offline', updateOfflineUI);
window.addEventListener('load', () => { updateOfflineUI(); if (navigator.onLine) syncQueuedLogs(); });
