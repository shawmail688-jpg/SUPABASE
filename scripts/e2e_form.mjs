// e2e_form.mjs — TASK-009 E2E：真实 Supabase REST + JWT + RLS 全链验证
// 流程：svy1 登录 → project 解析 → site upsert（RLS）→ SR 插入 → 重放幂等 → 冒名拒 → 匿名零 → manager 读
import { readFileSync, writeFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}
const ref = env.SUPABASE_URL.split('//')[1].split('.')[0];
const rest = env.SUPABASE_URL + '/rest/v1';
const auth = env.SUPABASE_URL + '/auth/v1';
const results = [];
const ck = (name, ok, detail) => { results.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : '')); };


// ① svy1 登录（真实密码）
const loginRes = await fetch(auth + '/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'svy1-test@survey.local', password: 'D3-e2e-2026!' }),
});
const login = await loginRes.json();
ck('① svy1 登录', loginRes.status === 200 && !!login.access_token, 'HTTP ' + loginRes.status);
if (!login.access_token) {
    console.log('E2E VERDICT: FAIL (登录失败)');
  process.exit(1);
}
const userHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login.access_token, 'Content-Type': 'application/json' };

// ② project uuid 解析（RLS project_select authenticated）
const projRes = await fetch(rest + '/project?code=eq.uganda-showroom&select=id', { headers: userHeaders });
const projRows = await projRes.json();
const pid = projRows[0]?.id;
ck('② project 解析', !!pid, 'pid=' + (pid || '∅'));

// ③ 新点 site upsert（RLS: site_insert created_by=auth.uid()；无显式 created_by → default auth.uid()）
const siteId = 'eeeeeeee-1111-4111-8111-111111111111';
const siteRes = await fetch(rest + '/site', {
  method: 'POST', headers: { ...userHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: siteId, project_id: pid, code: 'FL-E2E-1', name: 'E2E Test Point', grp: 'A', status: 'surveying' }),
});
const siteBody = await siteRes.json();
const createdByOk = Array.isArray(siteBody) && siteBody[0]?.created_by === login.user?.id;
ck('③ site upsert（RLS 写自己）', (siteRes.status === 201 || siteRes.status === 200) && createdByOk,
  'HTTP ' + siteRes.status + ' created_by=' + (siteBody[0]?.created_by || '∅'));

// ④ SR 插入（RLS: created_by=auth.uid()）
const srId = 'eeeeeeee-2222-4222-8222-222222222222';
const srRes = await fetch(rest + '/survey_result', {
  method: 'POST', headers: { ...userHeaders, Prefer: 'return=representation' },
  body: JSON.stringify({ id: srId, site_id: siteId, rent: 500, space: 150, source: 'form', raw: { e2e: true, note: 'TASK-009' } }),
});
ck('④ SR 插入（RLS 写自己）', srRes.status === 201 || srRes.status === 409, 'HTTP ' + srRes.status);

// ⑤ SR 重放（同 id ignore-duplicates）→ 零新增
const srReplay = await fetch(rest + '/survey_result', {
  method: 'POST', headers: { ...userHeaders, Prefer: 'resolution=ignore-duplicates' },
  body: JSON.stringify({ id: srId, site_id: siteId, source: 'form' }),
});
const srCheck = await fetch(rest + '/survey_result?id=eq.' + srId + '&select=id', { headers: userHeaders });
const srRows = await srCheck.json();
ck('⑤ SR 重放幂等（仍 1 行）', srCheck.status === 200 && srRows.length === 1, 'rows=' + (Array.isArray(srRows) ? srRows.length : 'n/a'));

// ⑥ svy2 冒名 created_by=svy1 → with check 拒
const login2 = await fetch(auth + '/token?grant_type=password', {
  method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'svy2-test@survey.local', password: 'D3-e2e-2026!' }),
});
const login2Body = await login2.json();
const forgeRes = await fetch(rest + '/survey_result', {
  method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + login2Body.access_token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'eeeeeeee-3333-4333-8333-333333333333', site_id: siteId, created_by: login.user.id, source: 'form' }),
});
ck('⑥ svy2 冒名 created_by 被拒', forgeRes.status >= 400, 'HTTP ' + forgeRes.status);

// ⑦ 匿名零权限
const anonRes = await fetch(rest + '/site?select=id', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } });
const anonRows = await anonRes.json();
ck('⑦ anon 读 site = 0 行', Array.isArray(anonRows) && anonRows.length === 0, 'rows=' + (Array.isArray(anonRows) ? anonRows.length : 'n/a'));

// ⑧ manager 读 SR（含 svy1 行）
const mgrLogin = await fetch(auth + '/token?grant_type=password', {
  method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mgr-test@survey.local', password: 'D3-e2e-2026!' }),
});
const mgr = await mgrLogin.json();
const mgrRes = await fetch(rest + '/survey_result?id=eq.' + srId + '&select=id', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + mgr.access_token } });
const mgrRows = await mgrRes.json();
ck('⑧ manager 读 SR（svy1 行）', Array.isArray(mgrRows) && mgrRows.length >= 1, 'rows=' + mgrRows.length);

// 清理 E2E 数据（service key 旁路 RLS）
await fetch(rest + '/survey_result?id=eq.' + srId, { method: 'DELETE', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY } });
await fetch(rest + '/site?id=eq.' + siteId, { method: 'DELETE', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY } });
console.log('清理: E2E SR+site 已删除（service key）');

const pass = results.filter(r => r.ok).length;
console.log('E2E VERDICT: ' + pass + '/' + results.length + (pass === results.length ? ' ALL_PASS' : ' FAIL'));
writeFileSync('docs/features/v1-launch/evidence-task006/e2e_results.json',
  JSON.stringify({ verdict: pass + '/' + results.length, results, cleanup_note: 'E2E SR+site 已删' }, null, 1));
