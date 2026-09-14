// migrate_data.mjs — TASK-005 存量导入（外审十条重构版）
// 用法：node migrate_data.mjs --dry-run   （只解析+映射报告，不写库）
//       node migrate_data.mjs --apply     （单事务：BEGIN; SET LOCAL; upsert; COMMIT —— 导入前必须人工审 mapping）
// 通道：优先 SUPABASE_DB_URL 原生连接（外审 #4/#7）；未配置则报错退出（不用 PostgREST 模拟会话）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
if (!DRY && !args.includes('--apply')) {
  console.error('用法: node migrate_data.mjs --dry-run | --apply');
  process.exit(2);
}

// ---- env ----
const env = {};
for (const line of readFileSync('.env', 'utf8').replace(/^\uFEFF/, '').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}
const ref = env.SUPABASE_URL.split('//')[1].split('.')[0];

// ---- deterministic UUID v5 (RFC4122, sha1) ----
const NS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex'); // URL ns
function uuid5(name) {
  const h = createHash('sha1').update(NS).update(name).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const slug = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- sources (per source-manifest.json) ----
const manifest = JSON.parse(readFileSync('source-manifest.json', 'utf-8'));
for (const m of manifest.sources) {
  const f = readFileSync(m.path);
  const got = createHash('sha256').update(f).digest('hex');
  if (got !== m.sha256) {
    console.error(`SHA256 不匹配: ${m.path}\n  manifest=${m.sha256}\n  实际  =${got}`);
    process.exit(3);
  }
}
console.log(`source-manifest 校验: ${manifest.sources.length} 个源全部匹配`);

// ---- load ----
const ledger = JSON.parse(readFileSync(manifest.sources.find(s => s.id === 'survey_points').path, 'utf-8'));
const fengshui = JSON.parse(readFileSync(manifest.sources.find(s => s.id === 'fengshui_evals').path, 'utf-8'));
const showroomCsv = readFileSync(manifest.sources.find(s => s.id === 'showroom_sites').path, 'utf-8');
const resultsCsv = readFileSync(manifest.sources.find(s => s.id === 'survey_results').path, 'utf-8');

// ---- 1. showroom rows -> site 候选 ----
const showroom = parse(showroomCsv, { columns: true, skip_empty_lines: true, bom: true });
// csv-parse 已按头解析；表头首列为空名
const sites = [];
const siteByName = new Map();
const dupSiteRows = [];
for (const r of showroom) {
  const name = (r[' Name of Building'] || '').trim();
  if (!name) continue;
  const key = slug(name);
  if (siteByName.has(key)) { dupSiteRows.push(name); continue; }
  const site = {
    id: uuid5('site:uganda-showroom:' + key),
    code: 'SR-' + key.toUpperCase().slice(0, 24),
    name,
    address: (r['Area/Street Name'] || '').trim() || null,
    rent_note: (r['Rent per square meter'] || '').trim() || null, // 保留原话（$13 等），D4 不做币种换算
    space_note: (r['Space Available'] || '').trim() || null,
    area_code: (r['Area Code'] || '').trim() || null,
    contact: (r['Contact person '] || '').trim() || null,
    added: (r['Added'] || '').trim() || null,
    surveyor: (r['Surveyor'] || '').trim() || null,
    slug: key,
  };
  sites.push(site);
  siteByName.set(key, site);
}

// ---- 2. survey_results rows：NEW-POINT（点定义）/ Lead（线索）/ 重复行 ----
const resRows = parse(resultsCsv).map(r => r.map(c => (c ?? '').trim()));
const pointDefs = new Map();   // FL/SP id -> 点定义
const leads = [];
const dupLeads = [];
const seenLead = new Set();
const unknownRows = [];
for (const c of resRows) {
  if (!c.length || !c[0]) continue;
  const [date, spId, road, name, marker] = c;
  if (marker === 'NEW-POINT') {
    if (!pointDefs.has(spId)) pointDefs.set(spId, { date, spId, road, name, pin: c[6] || null });
    continue;
  }
  const key = sha1(JSON.stringify(c));
  if (seenLead.has(key)) { dupLeads.push({ spId, marker, hash: key.slice(0, 8) }); continue; }
  seenLead.add(key);
  if (marker === 'Lead' || marker === 'Verify' || marker === 'VerifyLead') {
    leads.push({ date, spId, road, name, marker, c });
  } else {
    unknownRows.push(c.slice(0, 5));
  }
}

// ---- 3. SP 簇锚点（不导入 site；映射表列 deferred）----
const spAnchors = (ledger.survey_points || []).map(p => ({
  sp_id: p.sp_id || p.id, name: p.name || p.point_name, origin: p.origin,
  lat: p.lat ?? null, lon: p.lon ?? null,
}));

// ---- 4. 关联 ----
// 4a. Lead 行 -> site：按点定义 name 归一匹配 showroom slug
function matchSite(name) {
  const k = slug(name || '');
  if (!k) return { site: null, how: 'empty' };
  if (siteByName.has(k)) return { site: siteByName.get(k), how: 'exact' };
  for (const [key, s] of siteByName) {
    if (key.includes(k) || k.includes(key)) return { site: s, how: 'fuzzy:' + key };
  }
  return { site: null, how: 'unmatched' };
}
const leadMapped = [];
const leadsUnmatched = [];
for (const l of leads) {
  const def = pointDefs.get(l.spId);
  const name = (def && def.name) || l.name;
  const { site, how } = matchSite(name);
  const rec = {
    sr_id: uuid5('sr:results:' + sha1(JSON.stringify(l.c))),
    date: l.date, sp_id: l.spId, point_name: name, marker: l.marker,
    raw: l.c,
  };
  if (site) { rec.site_id = site.id; rec.match = how; leadMapped.push(rec); }
  else { rec.match = how; leadsUnmatched.push(rec); }
}

// 4b. fengshui_evals -> site（slug 精确/包含匹配）
const feMapped = [];
const feUnmatched = [];
for (const [fslug, ev] of Object.entries(fengshui)) {
  let hit = siteByName.get(fslug) || null;
  let how = hit ? 'exact' : null;
  if (!hit) {
    for (const [key, s] of siteByName) {
      if (key.includes(fslug) || fslug.includes(key)) { hit = s; how = 'fuzzy:' + key; break; }
    }
  }
  if (hit) feMapped.push({ fe_slug: fslug, site_id: hit.id, site_name: hit.name, how, verdict: ev.verdict });
  else feUnmatched.push({ fe_slug: fslug, verdict: ev.verdict });
}

// ---- 5. migration-map.json（人工可审）----
const map = {
  generated_at: new Date().toISOString(),
  mode: DRY ? 'dry-run' : 'apply',
  project: { code: 'uganda-showroom' },
  sites: {
    count: sites.length,
    rows: sites.map(s => ({ id: s.id, code: s.code, name: s.name, slug: s.slug, address: s.address, status: 'surveying' })),
    duplicates_in_source: dupSiteRows,
  },
  survey_results: {
    lead_rows_total: leads.length + dupLeads.length,
    leads_unique: leadMapped.length + leadsUnmatched.length,
    mapped_to_site: leadMapped.map(l => ({ sr_id: l.sr_id, date: l.date, point: l.point_name, site: l.site_id, match: l.match })),
    unmatched: leadsUnmatched.map(l => ({ sr_id: l.sr_id, date: l.date, sp_id: l.sp_id, point: l.point_name, reason: l.match })),
    duplicates_dropped: dupLeads,
    unknown_marker_rows: unknownRows,
  },
  fengshui: { mapped: feMapped, unmatched: feUnmatched },
  sp_cluster_anchors: {
    note: '扫街簇锚点≠现实店面，按外审禁止直写 site；v1 不导入，留台账',
    count: spAnchors.length, rows: spAnchors,
  },
  retired_points: { count: (ledger.retired_points || []).length, note: '退役点不导入' },
  points_without_site: [...pointDefs.keys()].filter(id => {
    const def = pointDefs.get(id);
    return !matchSite(def.name).site;
  }),
};
writeFileSync('docs/features/v1-launch/evidence-task005/migration-map.json', JSON.stringify(map, null, 1));

// ---- 6. 摘要 ----
console.log('sites 候选:', sites.length, '| 源内重名:', dupSiteRows.length);
console.log('SR 行: unique', map.survey_results.leads_unique, '| dup 丢弃', dupLeads.length, '| 匹配到 site', leadMapped.length, '| 未匹配', leadsUnmatched.length, '| 未知标记', unknownRows.length);
console.log('fengshui: 匹配', feMapped.length, '| 未匹配', feUnmatched.length, feUnmatched.map(u => u.fe_slug));
console.log('SP 簇锚点(不导入):', spAnchors.length, '| retired(不导入):', (ledger.retired_points || []).length);
console.log('pointDefs 无 site:', map.points_without_site.length);
if (DRY) { console.log('DRY-RUN：零写库。请人工审 docs/features/v1-launch/evidence-task005/migration-map.json'); }
else {
  if (!env.SUPABASE_DB_URL) { console.error('ABORT: SUPABASE_DB_URL 未配置（原生连接硬要求）'); process.exit(4); }
  console.log('--apply 需要 SUPABASE_DB_URL；当前流程到此处（导入执行另阶段）');
}
