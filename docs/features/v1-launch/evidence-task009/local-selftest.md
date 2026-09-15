# TASK-009 local browser evidence

Run date: 2026-09-15

- Edge headless `#/selftest`: `SELFTEST_ALL_PASS` (44/44).
- Edge headless `#/selftest2`: `SELFTEST2 ALL_PASS 33/33`.
- Mobile viewport 375×812: `SELFTEST_ALL_PASS`, `NO-H-OVERFLOW PASS`.
- Covered in selftest2: atomic resolver call, survey UUID/CR-004 payload, no-session queue, offline zero-fetch, one-time 401 refresh/replay, archived rejection before site insert, Canvas JPEG profile assertion, dual failed-side retention/completion, target snapshot retention.
- Live Auth/Storage/Postgres/Sheet E2E remains pending until isolated test credentials are supplied after rotation; `scripts/e2e_form.mjs` exits non-zero on failures and never contains passwords.
