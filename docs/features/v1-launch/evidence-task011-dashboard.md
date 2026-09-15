# TASK-011 dashboard skeleton evidence

Run date: 2026-09-15

- `web/dashboard/index.html`, `leader.html`, `work.html`, `lib/api.js`, `lib/config.js`, `lib/tokens.css`, and `lib/app.js` are present.
- Edge headless `index.html#/selftest`: `DASHBOARD_SELFTEST_ALL_PASS` (7/7).
- Checks cover latest Survey ordering, missing-pin preservation, USD fallback, tile failover threshold (switches after exactly three failures), and zero `tile.openstreetmap.org` dependency.
- `py scripts/build_dashboard.py --inject`: `DASHBOARD_CONFIG_INJECT=PASS`; injected artifact contains publishable key only.
