// migrate_photos.mjs — TASK-006 照片上云 + 挂载（外审纪律：sha1 幂等，二遍零新增）
// 用法：node migrate_photos.mjs --dry-run | --apply
// 通道：文件 → Storage REST（secret key 双头，knowledge E3）；photo 行 → Management API 单事务批
// 源：E:\项目\uganda-house-finder\data\survey\photos\{site-slug}__{label}.jpg（45 张已人工筛过尺寸）
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-run');
if (!APPLY && !DRY) { console.error('用法: node migrate_photos.mjs --dry-run | --apply'); process.exit(2); }

const env = {};
for (const line of readFileSync('.env', 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}
const ref = env.SUPABASE_URL.split('//')[1].split('.')[0];
const SVC = '11111111-1111-1111-1111-111111111111';
const SRC_DIR = String.raw`E:\项目\uganda-house-finder\data\survey\photos`;
const BUCKET = 'photos';
const PROJECT_CODE = 'uganda-showroom';
const secret = env.SUPABASE_SECRET_KEY;

const NS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
function uuid5(name) {
  const h = createHash('sha1').update(NS).update(name).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const sha1buf = (buf) => createHash('sha1').update(buf).digest('hex');

// slug 映射取自 migration-map.json（避免 site.code 24 字符截断反解失败）
const map = JSON.parse(readFileSync('docs/features/v1-launch/evidence-task005/migration-map.json', 'utf-8'));
const slugById = new Map();
for (const s of map.sites.rows) {
  slugById.set(s.slug, { id: s.id, code: s.code, name: s.name });
}

// 扫描源照片
const files = readdirSync(SRC_DIR).filter(f => f.toLowerCase().endsWith('.jpg'));
const plan = [];
const unmatched = [];
for (const f of files) {
  const mfile = f.match(/^(.+?)__(.+)\.jpg$/);
  if (!mfile) { unmatched.push({ file: f, reason: 'naming' }); continue; }
  const site = slugById.get(mfile[1]);
  if (!site) { unmatched.push({ file: f, reason: 'site not in scope: ' + mfile[1] }); continue; }
  const buf = readFileSync(join(SRC_DIR, f));
  const sha = sha1buf(buf);
  plan.push({
    file: f, site_id: site.id, site_code: site.code,
    storage_path: `${PROJECT_CODE}/${site.code}/${sha}.jpg`,
    sha1: sha, bytes: buf.length, buf, label: mfile[2],
  });
}
const bySite = new Map();
for (const p of plan) bySite.set(p.site_code, (bySite.get(p.site_code) || 0) + 1);
console.log(`照片: ${plan.length} 张 | 未匹配: ${unmatched.length}`);
for (const [c, n] of bySite) console.log('  ', c, n);
for (const u of unmatched) console.log('  UNMATCHED:', u.file, '(' + u.reason + ')');

if (DRY) {
  mkdirSync('docs/features/v1-launch/evidence-task006', { recursive: true });
  writeFileSync('docs/features/v1-launch/evidence-task006/dry_run.json',
    JSON.stringify({ total: plan.length, by_site: Object.fromEntries(bySite), unmatched }, null, 1));
  console.log('DRY-RUN：零上传零写库。报告 evidence-task006/dry_run.json');
  process.exit(0);
}

// ---- apply：逐张上传 Storage，行收集后单事务批写入 photo 表 ----
const storageBase = env.SUPABASE_URL + '/storage/v1';
const apiBase = 'https://api.supabase.com/v1/projects/' + ref + '/database/query';
let uploaded = 0, failed = 0;
const rowValues = [];
for (const p of plan) {
  const up = await fetch(`${storageBase}/object/${BUCKET}/${p.storage_path}`, {
    method: 'POST',
    headers: {
      apikey: secret, Authorization: 'Bearer ' + secret,
      'Content-Type': 'image/jpeg', 'x-upsert': 'true',
    },
    body: p.buf,
  });
  if (!up.ok) { failed++; console.error('上传失败', p.file, up.status, (await up.text()).slice(0, 120)); continue; }
  uploaded++;
  const id = uuid5('photo:' + p.sha1);
  rowValues.push(`(uuid '${id}', uuid '${p.site_id}', '${p.storage_path}', '${p.sha1}', 'normal', '${SVC}')`);
}
console.log(`上传成功 ${uploaded}/${plan.length} | 失败 ${failed}`);

// photo 行：单事务批（SET LOCAL actor + inserts + commit）
let inserted = null;
if (rowValues.length) {
  const tx = `begin;
select set_config('app.actor_uuid', '${SVC}', true);
insert into public.photo (id, site_id, storage_path, sha1, kind, uploaded_by) values
  ${rowValues.join(',\n  ')}
on conflict (id) do nothing;
commit;`;
  const req = await fetch(apiBase, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: tx }),
  });
  const body = await req.text();
  console.log('photo 行批写入 ->', req.status, req.status === 201 ? 'OK' : body.slice(0, 300));
  inserted = req.status === 201;
}

// ---- 核验：库内 photo 计数 vs 源 ----
const vsql = `select s.code, count(p.id)::int n from public.site s
  left join public.photo p on p.site_id = s.id
  group by s.code order by s.code;`;
const vr = await fetch(apiBase, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: vsql }),
});
const vrows = jsonOrText(await vr.text());
console.log('库内 per-site photo 计数:', JSON.stringify(vrows));
console.log('PHOTO_MIGRATE:', failed === 0 && inserted ? 'PASS' : 'CHECK');

function jsonOrText(t) { try { return JSON.parse(t); } catch { return t.slice(0, 200); } }
