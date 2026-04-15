'use strict';

const BASE_URL = process.env.API_BASE_URL || 'https://solnuv-backend.onrender.com/api';
const ADMIN_TOKEN = process.env.ADMIN_BEARER_TOKEN || '';
const PROJECT_ID = process.env.SMOKE_PROJECT_ID || '00000000-0000-0000-0000-000000000000';
const CYCLE_ID = process.env.SMOKE_CYCLE_ID || '00000000-0000-0000-0000-000000000000';
const SUBMISSION_ID = process.env.SMOKE_SUBMISSION_ID || '00000000-0000-0000-0000-000000000000';

function hasAuth() {
  return typeof ADMIN_TOKEN === 'string' && ADMIN_TOKEN.trim().length > 0;
}

async function request(method, path, body, useAuth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && hasAuth()) headers.Authorization = `Bearer ${ADMIN_TOKEN}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    return { ok: true, status: res.status, payload };
  } catch (error) {
    return { ok: false, status: 0, payload: null, error: error?.message || 'Request failed' };
  }
}

function evaluateUnauth(checkName, result) {
  if (!result.ok) return { name: checkName, result: 'FAIL', detail: `Network error: ${result.error}` };
  if (result.status === 401) return { name: checkName, result: 'PASS', detail: `Auth gate enforced (${result.status})` };
  if (result.status >= 500) return { name: checkName, result: 'FAIL', detail: `Server error (${result.status})` };
  return { name: checkName, result: 'FAIL', detail: `Expected 401, got ${result.status}` };
}

function evaluateAuth(checkName, result, allowedStatuses = [200]) {
  if (!result.ok) return { name: checkName, result: 'FAIL', detail: `Network error: ${result.error}` };
  if (allowedStatuses.includes(result.status)) {
    return { name: checkName, result: 'PASS', detail: `Received ${result.status}` };
  }
  return { name: checkName, result: 'FAIL', detail: `Expected ${allowedStatuses.join('/')} got ${result.status}` };
}

async function run() {
  const rows = [];

  const health = await request('GET', '/health');
  rows.push(health.ok && health.status === 200
    ? { name: 'Health', result: 'PASS', detail: '200 OK' }
    : { name: 'Health', result: 'FAIL', detail: `Expected 200 got ${health.status || health.error}` });

  const verification = await request('GET', '/admin/verification-requests?status=pending', null, hasAuth());
  rows.push(hasAuth()
    ? evaluateAuth('Admin verification requests', verification, [200, 204])
    : evaluateUnauth('Admin verification requests', verification));

  const queue = await request('GET', '/admin/nerc/applications', null, hasAuth());
  rows.push(hasAuth()
    ? evaluateAuth('Admin NERC queue', queue, [200, 204])
    : evaluateUnauth('Admin NERC queue', queue));

  const triage = await request('GET', `/nerc/projects/${PROJECT_ID}/triage`, null, hasAuth());
  rows.push(hasAuth()
    ? evaluateAuth('Triage endpoint', triage, [200, 404])
    : evaluateUnauth('Triage endpoint', triage));

  const submissions = await request('GET', `/admin/nerc/reporting-cycles/${CYCLE_ID}/submissions`, null, hasAuth());
  rows.push(hasAuth()
    ? evaluateAuth('Cycle submissions list', submissions, [200, 404])
    : evaluateUnauth('Cycle submissions list', submissions));

  const decision = await request(
    'PATCH',
    `/admin/nerc/submissions/${SUBMISSION_ID}/decision`,
    { action: 'accept', regulator_message: 'smoke-check' },
    hasAuth()
  );
  rows.push(hasAuth()
    ? evaluateAuth('Submission decision flow', decision, [200, 404, 409])
    : evaluateUnauth('Submission decision flow', decision));

  console.log(`\nAPI Smoke Checklist (${hasAuth() ? 'AUTH MODE' : 'UNAUTH MODE'})`);
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('| Check | Result | Detail |');
  console.log('|---|---|---|');
  rows.forEach((row) => {
    console.log(`| ${row.name} | ${row.result} | ${row.detail} |`);
  });

  const failed = rows.filter((r) => r.result === 'FAIL');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Smoke run failed:', error?.message || error);
  process.exitCode = 1;
});
