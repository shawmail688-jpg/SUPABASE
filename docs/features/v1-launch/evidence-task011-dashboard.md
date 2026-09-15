# TASK-011 dashboard skeleton evidence

Run date: 2026-09-15

- `web/dashboard/index.html`, `leader.html`, `work.html`, `lib/api.js`, `lib/config.js`, `lib/tokens.css`, and `lib/app.js` are present.
- In-app Chromium `index.html#/selftest`: `DASHBOARD_SELFTEST_ALL_PASS` (11/11).
- Checks cover latest Survey ordering, missing-pin preservation, USD fallback, exact OSM Standard default, Esri fallbacks, and tile failover threshold (switches after exactly three failures).
- Live OSM tile request with production Referer `https://ugandastartimes.com/`: HTTP 200, `image/png`; browser rendered four loaded tiles with visible `© OpenStreetMap contributors` attribution and no console errors.
- `py scripts/build_dashboard.py --inject`: `DASHBOARD_CONFIG_INJECT=PASS`; injected artifact contains publishable key only.
