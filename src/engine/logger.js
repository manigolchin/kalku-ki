/**
 * LOGGER — Sends structured logs to /api/log for docker logs visibility
 *
 * Usage: log('autoCalc', 'Phase 1 complete', { classified: 69, total: 89 })
 */

const LOG_BUFFER = [];
const FLUSH_MS = 1500;
const LOG_ENDPOINT = '/api/log';

export function log(source, message, data = null, level = 'INFO') {
  const entry = {
    ts: new Date().toISOString(),
    level,
    source,
    message,
    data,
  };

  // Browser console
  if (level === 'ERROR') {
    console.error(`[${source}] ${message}`, data || '');
  } else {
    console.log(`[${source}] ${message}`, data || '');
  }

  // Buffer for server
  LOG_BUFFER.push(entry);
}

export function logError(source, message, data = null) {
  log(source, message, data, 'ERROR');
}

export function logWarn(source, message, data = null) {
  log(source, message, data, 'WARN');
}

// Flush to server periodically
setInterval(() => {
  if (LOG_BUFFER.length === 0) return;
  const batch = LOG_BUFFER.splice(0);
  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  }).catch(() => {
    // Server not available — put back in buffer (max 200)
    if (LOG_BUFFER.length < 200) LOG_BUFFER.push(...batch);
  });
}, FLUSH_MS);

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (LOG_BUFFER.length > 0) {
      navigator.sendBeacon(LOG_ENDPOINT, JSON.stringify(LOG_BUFFER));
    }
  });
}
