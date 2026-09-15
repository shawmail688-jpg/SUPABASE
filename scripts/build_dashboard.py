"""Inject only the public Supabase config into web/dashboard/config.js."""
import io, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env = {}
for line in io.open(root / '.env', encoding='utf-8-sig'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1); env[k.strip()] = v.strip()
if '--inject' in sys.argv:
    missing = [k for k in ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY') if not env.get(k)]
    if missing: raise SystemExit('missing .env keys: ' + ', '.join(missing))
    cfg = {'url': env['SUPABASE_URL'], 'key': env['SUPABASE_PUBLISHABLE_KEY'], 'project_code': 'uganda-showroom'}
    path = root / 'web' / 'dashboard' / 'lib' / 'config.js'
    text = path.read_text(encoding='utf-8')
    start = text.index('window.DASHBOARD_CONFIG')
    line_end = text.index('\n', start) if '\n' in text[start:] else len(text)
    replacement = 'window.DASHBOARD_CONFIG = ' + json.dumps(cfg, separators=(',', ':')) + ';'
    path.write_text(text[:start] + replacement + text[line_end:], encoding='utf-8')
    secret = env.get('SUPABASE_SECRET_KEY', '')
    if secret and secret in path.read_text(encoding='utf-8'): raise SystemExit('secret leaked')
    print('DASHBOARD_CONFIG_INJECT=PASS')
else:
    print('build_dashboard: use --inject for publishable config')
