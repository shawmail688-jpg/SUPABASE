// 直连（IPv6-only）失败时自动切 Session Pooler（IPv4）
import { readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const env = {};
for (const line of readFileSync('.env', 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}
if (!env.SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 为空'); process.exit(2); }

const ref = env.SUPABASE_URL.split('//')[1].split('.')[0];
const direct = env.SUPABASE_DB_URL;
const m = direct.match(/^postgresql:\/\/postgres:([^@]+)@db\.[a-z0-9]+\.supabase\.co:\d+\/postgres$/);
const pooler = m
  ? `postgresql://postgres.${ref}:${m[1]}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
  : null;

let active = postgres(direct, { prepare: false, max: 1, connect_timeout: 15 });
let via = 'direct';
try {
  await active`select 1`;
} catch (e) {
  console.error('直连失败:', (e.cause && e.cause.code) || e.message);
  try { await active.end({ timeout: 1 }); } catch {}
  if (!pooler) { console.error('无 pooler 替代可用'); process.exit(3); }
  console.log('切换 Session Pooler (IPv4) 重试...');
  active = postgres(pooler, { prepare: false, max: 1, connect_timeout: 15 });
  via = 'pooler (IPv4)';
  await active`select 1`;
}

const rows = await active`
  select
    (select count(*) from public.site) sites,
    (select count(*) from public.site_status_log) ssl,
    (select count(*) from public.fengshui_eval) fe,
    (select count(*) from public.survey_result) sr,
    (select count(*) from public.domain_config where version = 2 and config ? 'tasks') dcfg,
    (select count(*) from public.audit_log) audit`;
console.log('库内实况:', JSON.stringify(rows[0]));

const sites = await active`select code, name, status from public.site order by code`;
for (const s of sites) console.log(' ', s.code, '|', s.name, '|', s.status);

const expect = { sites: 7, ssl: 7, fe: 6, sr: 5, dcfg: 1 };
const ok = Object.entries(expect).every(([k, v]) => rows[0][k] === v);
console.log('NATIVE_CONN_VERIFY:', ok ? 'PASS' : 'FAIL', '| via:', via);
await active.end();
writeFileSync('docs/features/v1-launch/evidence-task005/native_conn_verify.log',
  'via=' + via + '\n' + JSON.stringify(rows[0]) + '\nsites: ' + sites.map(s => s.code).join(', ') + '\nNATIVE_CONN_VERIFY: ' + (ok ? 'PASS' : 'FAIL') + '\n');
