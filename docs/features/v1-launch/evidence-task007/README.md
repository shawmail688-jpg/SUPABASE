# TASK-007 compression evidence

Run date: 2026-09-15

- Source: 24 deterministic samples from the 45 migrated Uganda showroom photos.
- Coverage: exterior frontage/signage/road views plus interior and backlit dark-space views.
- Default profile: maximum edge 1800 px, JPEG quality 0.80, hard cap 1,000,000 bytes.
- Detail profile: maximum edge 2400 px, JPEG quality 0.90, hard cap 2,500,000 bytes.
- Result: default median 340.2 KB, maximum 481.1 KB; detail median 905.8 KB, maximum 1185.4 KB. Both profiles passed every cap assertion.
- Visual review: all 24 original/default side-by-side samples were reviewed. Storefront signs, TO LET signs, road context and dark/interior structure remained readable; 24/24 PASS.
- Browser assertion: a synthetic 2400×1200 source produces an 1800×900 `image/jpeg` under 1 MB through the same Canvas encoder used by the form.

Reproduce:

```powershell
py scripts/evaluate_photo_compression.py --source 'E:\项目\uganda-house-finder\data\survey\photos' --work $env:TEMP\survey-platform-task007 --report docs/features/v1-launch/evidence-task007/compression-report.json --limit 24
```

The generated JPEG samples live in the temporary work directory and are not committed; the per-file measurements are retained in `compression-report.json`.
