// e2e_form.mjs — TASK-009 live Supabase REST/RLS smoke test.
// Credentials are never committed. Required .env keys:
// E2E_SVY1_EMAIL/PASSWORD, E2E_SVY2_EMAIL/PASSWORD, E2E_MANAGER_EMAIL/PASSWORD.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const required = [
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'E2E_SVY1_EMAIL', 'E2E_SVY1_PASSWORD', 'E2E_SVY2_EMAIL', 'E2E_SVY2_PASSWORD',
  'E2E_MANAGER_EMAIL', 'E2E_MANAGER_PASSWORD',
];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error('E2E SKIP: missing local-only environment keys: ' + missing.join(', '));
  process.exit(2);
}

const rest = env.SUPABASE_URL + '/rest/v1';
const auth = env.SUPABASE_URL + '/auth/v1';
const results = [];
const siteId = randomUUID();
const srId = randomUUID();
const forgeId = randomUUID();
const siteCode = 'FL-E2E-' + siteId.slice(0, 8);
let serviceHeaders;

function ck(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
}
async function signIn(email, password) {
  const response = await fetch(auth + '/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { response, body: await response.json() };
}
function jwtHeaders(token) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
}
async function safeJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}

try {
  serviceHeaders = {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY,
    'Content-Type': 'application/json',
  };

  const svy1 = await signIn(env.E2E_SVY1_EMAIL, env.E2E_SVY1_PASSWORD);
  ck('① surveyor 1 login', svy1.response.status === 200 && !!svy1.body.access_token,
    'HTTP ' + svy1.response.status);
  if (!svy1.body.access_token) throw new Error('surveyor 1 login failed');
  const userHeaders = jwtHeaders(svy1.body.access_token);

  const projRes = await fetch(rest + '/project?code=eq.uganda-showroom&select=id', { headers: userHeaders });
  const projRows = await safeJson(projRes);
  const projectId = Array.isArray(projRows) ? projRows[0]?.id : null;
  ck('② project resolve', projRes.status === 200 && !!projectId, 'HTTP ' + projRes.status);

  const siteRes = await fetch(rest + '/site', {
    method: 'POST', headers: { ...userHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ id: siteId, project_id: projectId, code: siteCode,
      name: 'E2E Test Point', grp: 'A', status: 'surveying' }),
  });
  const siteRows = await safeJson(siteRes);
  ck('③ site insert owns created_by', siteRes.status === 201 && Array.isArray(siteRows) &&
    siteRows[0]?.created_by === svy1.body.user?.id, 'HTTP ' + siteRes.status);

  const surveyedAt = new Date().toISOString();
  const surveyPayload = { id: srId, site_id: siteId, rent: 500, space: 150, source: 'form',
    created_at: surveyedAt,
    raw: { e2e: true, currency: 'USD', surveyed_at: surveyedAt, supersedes: null, site_code: siteCode } };
  const srRes = await fetch(rest + '/survey_result', {
    method: 'POST', headers: { ...userHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(surveyPayload),
  });
  const srRows = await safeJson(srRes);
  ck('④ survey_result insert + CR-004 metadata', srRes.status === 201 && Array.isArray(srRows) &&
    srRows[0]?.created_by === svy1.body.user?.id && srRows[0]?.raw?.currency === 'USD',
    'HTTP ' + srRes.status);

  const replayRes = await fetch(rest + '/survey_result?on_conflict=id', {
    method: 'POST', headers: { ...userHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(surveyPayload),
  });
  const srCheck = await fetch(rest + '/survey_result?id=eq.' + srId + '&select=id', { headers: userHeaders });
  const replayRows = await safeJson(srCheck);
  ck('⑤ same UUID replay is idempotent', replayRes.status >= 200 && replayRes.status < 300 &&
    srCheck.status === 200 && Array.isArray(replayRows) && replayRows.length === 1,
    'replay HTTP ' + replayRes.status + ', rows=' + (Array.isArray(replayRows) ? replayRows.length : 'n/a'));

  const svy2 = await signIn(env.E2E_SVY2_EMAIL, env.E2E_SVY2_PASSWORD);
  ck('⑥ surveyor 2 login', svy2.response.status === 200 && !!svy2.body.access_token,
    'HTTP ' + svy2.response.status);
  const forgeRes = await fetch(rest + '/survey_result', {
    method: 'POST', headers: jwtHeaders(svy2.body.access_token),
    body: JSON.stringify({ id: forgeId, site_id: siteId, created_by: svy1.body.user.id, source: 'form' }),
  });
  ck('⑦ forged created_by rejected', forgeRes.status >= 400, 'HTTP ' + forgeRes.status);

  const anonRes = await fetch(rest + '/site?select=id', {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  const anonRows = await safeJson(anonRes);
  ck('⑧ anonymous site read is empty', anonRes.status === 200 && Array.isArray(anonRows) && anonRows.length === 0,
    'rows=' + (Array.isArray(anonRows) ? anonRows.length : 'n/a'));

  const manager = await signIn(env.E2E_MANAGER_EMAIL, env.E2E_MANAGER_PASSWORD);
  ck('⑨ manager login', manager.response.status === 200 && !!manager.body.access_token,
    'HTTP ' + manager.response.status);
  const managerRes = await fetch(rest + '/survey_result?id=eq.' + srId + '&select=id', {
    headers: jwtHeaders(manager.body.access_token),
  });
  const managerRows = await safeJson(managerRes);
  ck('⑩ manager reads surveyor result', managerRes.status === 200 && Array.isArray(managerRows) && managerRows.length === 1,
    'rows=' + (Array.isArray(managerRows) ? managerRows.length : 'n/a'));
} catch (error) {
  ck('setup/runtime', false, error instanceof Error ? error.message : String(error));
} finally {
  if (serviceHeaders) {
    const deleteSurvey = await fetch(rest + '/survey_result?id=eq.' + srId, { method: 'DELETE', headers: serviceHeaders });
    const deleteForge = await fetch(rest + '/survey_result?id=eq.' + forgeId, { method: 'DELETE', headers: serviceHeaders });
    const deleteSite = await fetch(rest + '/site?id=eq.' + siteId, { method: 'DELETE', headers: serviceHeaders });
    const verifyClean = await fetch(rest + '/site?id=eq.' + siteId + '&select=id', { headers: serviceHeaders });
    const cleanRows = await safeJson(verifyClean);
    ck('cleanup verified', deleteSurvey.status < 300 && deleteForge.status < 300 && deleteSite.status < 300 &&
      verifyClean.status === 200 && Array.isArray(cleanRows) && cleanRows.length === 0,
      'survey=' + deleteSurvey.status + ', forge=' + deleteForge.status + ', site=' + deleteSite.status);
  }
}

const pass = results.filter((r) => r.ok).length;
const verdict = pass + '/' + results.length;
console.log('E2E VERDICT: ' + verdict + (pass === results.length ? ' ALL_PASS' : ' FAIL'));
mkdirSync('docs/features/v1-launch/evidence-task009', { recursive: true });
writeFileSync('docs/features/v1-launch/evidence-task009/e2e_results.json',
  JSON.stringify({ verdict, results, cleanup_verified: results.some((r) => r.name === 'cleanup verified' && r.ok) }, null, 2));
if (pass !== results.length) process.exitCode = 1;
