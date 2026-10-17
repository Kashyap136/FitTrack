#!/usr/bin/env node
/**
 * FitTrack Community — production smoke test.
 *
 * Exercises a *running* deployment end-to-end (API + frontend) using only the
 * global `fetch`, so it needs no dependencies. Intended to be run after
 * `npm run build` and starting the production servers:
 *
 *   npm run smoke
 *
 * Configuration (all optional, sensible localhost defaults):
 *   API_URL / NEXT_PUBLIC_API_URL   backend base URL   (default http://localhost:5000)
 *   APP_URL                         frontend base URL  (default http://localhost:3000)
 *   SMOKE_EMAIL / SMOKE_PASSWORD    demo login         (default the seeded Aarav account)
 *   SMOKE_HANDLE                    public profile     (default "aaravfit")
 *   SMOKE_WAIT_MS                   readiness timeout  (default 60000)
 *   SMOKE_TIMEOUT_MS                per-request timeout (default 15000)
 *
 * Exits with code 0 when every check passes, 1 otherwise.
 */

const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_EMAIL || 'aarav@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD || 'FitTrack@123';
const HANDLE = process.env.SMOKE_HANDLE || 'aaravfit';
const WAIT_MS = Number(process.env.SMOKE_WAIT_MS || 60000);
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

let token = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function req(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON (HTML) response */
  }
  return { status: response.status, headers: response.headers, text, json };
}

const api = (path, options) => req(API_URL + path, options);
const web = (path, options) => req(APP_URL + path, options);
const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

async function waitFor(label, attempt) {
  const deadline = Date.now() + WAIT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await attempt()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(`${label} was not ready within ${WAIT_MS}ms${lastError ? ` (${lastError.message})` : ''}`);
}

/* ------------------------------------------------------------------- checks */

const PUBLIC_PAGES = ['/', '/login', '/register', '/feed', '/challenges', '/leaderboard', '/settings'];

const checks = [
  ['GET /api/health → 200 ok', async () => {
    const r = await api('/api/health');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.status === 'ok', 'body.status !== "ok"');
    assert(typeof r.json.environment === 'string', 'missing environment');
  }],

  ['GET /api/ready → 200 (DB connected)', async () => {
    const r = await api('/api/ready');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.success === true, 'database not connected');
  }],

  ['API sends security headers', async () => {
    const r = await api('/api/health');
    assert(r.headers.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options');
    assert(r.headers.get('x-frame-options') === 'DENY', 'missing X-Frame-Options');
    assert(r.headers.get('content-security-policy'), 'missing Content-Security-Policy');
    assert(!r.headers.get('x-powered-by'), 'x-powered-by should be disabled');
  }],

  ['Unknown API route → 404', async () => {
    const r = await api('/api/__does_not_exist__');
    assert(r.status === 404, `expected 404, got ${r.status}`);
  }],

  ['POST /api/auth/login → 200 + token', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    assert(r.status === 200, `expected 200, got ${r.status} — is the database seeded?`);
    assert(r.json && typeof r.json.token === 'string' && r.json.token.length > 20, 'missing token');
    assert(r.json.user && r.json.user.handle === HANDLE, `unexpected user ${r.json.user && r.json.user.handle}`);
    token = r.json.token;
  }],

  ['GET /api/auth/me (token) → 200', async () => {
    const r = await api('/api/auth/me', { headers: authHeaders() });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.user && r.json.user.handle === HANDLE, 'wrong user in /me');
  }],

  ['GET /api/feed/list → 200 + workouts[]', async () => {
    const r = await api('/api/feed/list?page=1&limit=5', { headers: authHeaders() });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && Array.isArray(r.json.workouts), 'body.workouts is not an array');
    assert(r.json.workouts.length <= 5, 'pagination limit ignored');
  }],

  ['GET /api/workouts/prs/mine → 200', async () => {
    const r = await api('/api/workouts/prs/mine', { headers: authHeaders() });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.success === true, 'unsuccessful response');
  }],

  ['GET /api/stats/:handle (public) → 200', async () => {
    const r = await api(`/api/stats/${HANDLE}`);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.success === true && r.json.stats, 'missing stats payload');
  }],

  ['GET /api/settings (token) → 200', async () => {
    const r = await api('/api/settings', { headers: authHeaders() });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json && r.json.settings, 'missing settings payload');
  }],

  ['Authorization enforced: /api/settings without token → 401', async () => {
    const r = await api('/api/settings');
    assert(r.status === 401, `expected 401, got ${r.status}`);
  }],

  ['Validation enforced: register with empty body → 400', async () => {
    const r = await api('/api/auth/register', { method: 'POST', body: {} });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  }],

  ['Frontend serves all public pages → 200', async () => {
    const paths = [...PUBLIC_PAGES, `/profile/${HANDLE}`];
    const failures = [];
    for (const path of paths) {
      const r = await web(path);
      if (r.status !== 200 || !r.text.includes('FitTrack')) failures.push(`${path} (${r.status})`);
    }
    assert(failures.length === 0, `failed: ${failures.join(', ')}`);
  }],

  ['Frontend sends security headers', async () => {
    const r = await web('/login');
    assert(r.headers.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options');
    assert(!r.headers.get('x-powered-by'), 'x-powered-by should be disabled');
  }],
];

/* --------------------------------------------------------------------- run */

(async () => {
  console.log('\nFitTrack production smoke test');
  console.log('------------------------------');
  console.log(`API:      ${API_URL}`);
  console.log(`Frontend: ${APP_URL}`);
  console.log(`Login:    ${EMAIL}`);
  console.log('');

  await waitFor('API', async () => (await api('/api/health')).status === 200);
  await waitFor('frontend', async () => {
    const r = await web('/login');
    return r.status >= 200 && r.status < 400;
  });

  let passed = 0;
  const failures = [];

  for (const [name, run] of checks) {
    try {
      await run();
      passed += 1;
      console.log(`  PASS  ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
    }
  }

  console.log('');
  console.log(`${passed}/${checks.length} checks passed.`);
  if (failures.length) {
    console.log('\nSMOKE TEST FAILED\n');
    process.exit(1);
  }
  console.log('\nSMOKE TEST PASSED\n');
})().catch((error) => {
  console.error(`\nSMOKE TEST ERROR: ${error.message}\n`);
  process.exit(1);
});
