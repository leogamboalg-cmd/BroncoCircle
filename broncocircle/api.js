/* Shared browser API client. No secrets belong in this file. */
'use strict';
window.BroncoAPI = (() => {
  const key = 'broncocircle-token';
  let token = '';
  try { token = sessionStorage.getItem(key) || ''; } catch { /* In-memory sessions still work. */ }
  const client = {
    mode: 'checking',
    get token() { return token; },
    setToken(value) {
      token = value || '';
      try { if (token) sessionStorage.setItem(key, token); else sessionStorage.removeItem(key); } catch { /* Keep this visit working. */ }
    },
    async request(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
      const requestToken = token;
      const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
      let response;
      try {
        response = await fetch(`/api${path}`, {
          method, signal: AbortSignal.timeout(timeoutMs),
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: multipart ? body : JSON.stringify(body) } : {})
        });
      } catch { throw new Error('Cannot reach the server. Your changes have not been saved. Try again.'); }
      const data = await response.json().catch(() => null);
      if (requestToken && requestToken !== token) throw Object.assign(new Error('Session changed.'), { stale: true });
      if (!response.ok || !data) {
        if (response.status === 401 && token) client.setToken('');
        throw Object.assign(new Error(data?.error || 'The server could not complete this request.'), { status: response.status });
      }
      return data;
    },
    // Convert Pacific wall time independently of the device's timezone. Reject
    // nonexistent spring-forward times instead of silently shifting the plan.
    pacificTime(date, time) {
      const expected = `${date}T${time}`;
      const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      for (const offset of ['-07:00', '-08:00']) {
        const candidate = new Date(`${expected}:00${offset}`);
        if (Number.isFinite(candidate.getTime()) && formatter.format(candidate).replace(' ', 'T') === expected) return candidate.toISOString();
      }
      throw new Error('Choose a valid Pacific date and time. That time may fall in the daylight saving clock change.');
    },
    localParts(value) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
      return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
    }
  };
  client.ready = (async () => {
    if (location.protocol === 'file:' || location.hostname.endsWith('.github.io')) { client.mode = 'demo'; return; }
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
      client.mode = response.ok && (await response.json()).status === 'ok' ? 'live' : 'demo';
    } catch { client.mode = 'demo'; }
  })();
  return client;
})();
