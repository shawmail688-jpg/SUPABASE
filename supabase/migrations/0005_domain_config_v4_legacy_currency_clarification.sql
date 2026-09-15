-- CR-004 clarification from the user, 2026-09-15:
-- historical amounts were already entered in USD; only the old UI label said UGX.
-- No numeric conversion or backfill is permitted.
insert into public.domain_config (project_id, version, config)
select dc.project_id, 4,
       dc.config || jsonb_build_object(
         'schema_note', 'CR-004 v4; USD/month label correction; historical numeric amounts were already USD and must not be converted',
         'legacy_currency_policy', jsonb_build_object(
           'missing_currency_means', 'USD',
           'conversion', 'none',
           'decision_date', '2026-09-15'
         )
       )
from public.domain_config dc
join public.project p on p.id = dc.project_id
where p.code = 'uganda-showroom' and dc.version = 3
on conflict (project_id, version) do nothing;
