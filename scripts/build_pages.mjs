/** Build the single-entry Cloudflare Pages bundle. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dashboard = path.join(root, 'web', 'dashboard');
const survey = path.join(root, 'webapp', 'survey_form.html');
const output = path.join(root, 'dist', 'pages');
const zipOutput = path.join(root, 'dist', 'uganda-house-finder-pages.zip');

function readEnv() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, '.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const split = line.indexOf('=');
    values[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return values;
}

function injectDashboardConfig(env) {
  const file = path.join(output, 'lib', 'config.js');
  const config = { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, project_code: 'uganda-showroom' };
  const source = fs.readFileSync(file, 'utf8');
  const marker = /window\.DASHBOARD_CONFIG\s*=\s*\{.*?\};/;
  if (!marker.test(source)) throw new Error('dashboard config marker not found');
  const built = source.replace(marker, `window.DASHBOARD_CONFIG = ${JSON.stringify(config)};`);
  fs.writeFileSync(file, built);
}

function injectSurveyConfig(env) {
  const file = path.join(output, 'survey.html');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('<!--BLD:CONFIG:START-->');
  const end = source.indexOf('<!--BLD:CONFIG:END-->', start);
  if (start < 0 || end < 0) throw new Error('survey config block not found');
  const config = { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, target: 'supabase', project_code: 'uganda-showroom' };
  const block = source.slice(start, end);
  const marker = /window\.SUPABASE_CONFIG=\{.*?\};/;
  if (!marker.test(block)) throw new Error('survey config marker not found');
  const builtBlock = block.replace(marker, `window.SUPABASE_CONFIG=${JSON.stringify(config)};`);
  fs.writeFileSync(file, source.slice(0, start) + builtBlock + source.slice(end));
}

function assertNoSecret(env) {
  if (!env.SUPABASE_SECRET_KEY) return;
  const pending = [output];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (fs.readFileSync(full, 'utf8').includes(env.SUPABASE_SECRET_KEY)) throw new Error(`secret leaked into Pages bundle: ${full}`);
    }
  }
}

function fingerprintDashboardAssets() {
  const indexFile = path.join(output, 'index.html');
  const assets = ['lib/tokens.css', 'lib/config.js', 'lib/map.js', 'lib/api.js', 'lib/app.js'];
  let html = fs.readFileSync(indexFile, 'utf8');
  for (const asset of assets) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(output, asset))).digest('hex').slice(0, 12);
    html = html.replaceAll(asset, `${asset}?v=${digest}`);
  }
  fs.writeFileSync(indexFile, html);
}

function packageZip() {
  fs.rmSync(zipOutput, { force: true });
  let result;
  if (process.platform === 'win32') {
    const sourceGlob = `${output.replaceAll("'", "''")}\\*`;
    const destination = zipOutput.replaceAll("'", "''");
    result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${sourceGlob}' -DestinationPath '${destination}' -Force`], { encoding: 'utf8' });
  } else {
    result = spawnSync('zip', ['-qr', zipOutput, '.'], { cwd: output, encoding: 'utf8' });
  }
  if (result.status !== 0 || !fs.existsSync(zipOutput)) {
    throw new Error(`Pages ZIP packaging failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
}

const env = readEnv();
const missing = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'].filter((key) => !env[key]);
if (missing.length) throw new Error(`missing .env keys: ${missing.join(', ')}`);
if (!output.startsWith(path.join(root, 'dist') + path.sep)) throw new Error('unsafe output path');

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(dashboard, output, { recursive: true });
fs.copyFileSync(survey, path.join(output, 'survey.html'));
injectDashboardConfig(env);
injectSurveyConfig(env);
fingerprintDashboardAssets();
assertNoSecret(env);
packageZip();

console.log('PAGES_BUNDLE=PASS');
console.log('ENTRY=/');
console.log('SURVEY=/survey.html');
console.log(`ZIP=${zipOutput}`);
