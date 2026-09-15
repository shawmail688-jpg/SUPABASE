-- Sync the latest rent values from sources/showroom_sites.csv into the typed
-- survey_result.rent projection. Append-only: historical rows remain untouched.
-- Source values are preserved as USD numbers per CR-004; no conversion.
begin;
select set_config('app.actor_uuid', '11111111-1111-1111-1111-111111111111', true);
select set_config('app.migration', 'on', true);

insert into public.survey_result
  (id, site_id, rent, space, contact, surveyor_name, added_date, raw, source, created_by, created_at)
values
  ('fbdbab4e-483a-5cff-ba14-3b07fffaf616',
   '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7',
   1600, null, 'Yasin mukwano 0775037333', null, '2026-09-01',
   '{
      "type": "rent_sync",
      "currency": "USD",
      "rent_source_unit": "Rent per square meter",
      "rent_source": "sources/showroom_sites.csv",
      "source_surveyed_at": "2026-09-01",
      "surveyed_at": "2026-09-15T18:00:00+03:00",
      "supersedes": "03a36bfb-23a5-59e2-b47c-a5eb5c62cfa2",
      "source_row": ["2026-09-01", "FL-02", "Old portbell road", "Former hisence showroom Plot 7 AK", "Lead", "lt300", "1600", "Yasin mukwano 0775037333"]
    }'::jsonb,
   'migration', '11111111-1111-1111-1111-111111111111', '2026-09-15 18:00:00+03'),
  ('0177f54a-d4bc-5cdc-b150-22551d220503',
   '4aaba04f-8ddd-5d04-a51f-17ecede5d5e6',
   1600, null, 'Yasin', null, '2026-09-01',
   '{
      "type": "rent_sync",
      "currency": "USD",
      "rent_source_unit": "Rent per square meter",
      "rent_source": "sources/showroom_sites.csv",
      "source_surveyed_at": "2026-09-01",
      "surveyed_at": "2026-09-15T18:00:00+03:00",
      "supersedes": null,
      "source_row": ["2026-09-01", "FL-02", "Old portbell road", "Former Nexa solar", "Lead", "lt300", "1600", "Yasin"]
    }'::jsonb,
   'migration', '11111111-1111-1111-1111-111111111111', '2026-09-15 18:00:00+03'),
  ('813b96b0-677b-53a4-b09f-c6ce9f3be08f',
   '2c02198f-2de8-5f1c-8ea2-a5389b3ce8ff',
   9, null, null, null, '2026-09-01',
   '{
      "type": "rent_sync",
      "currency": "USD",
      "rent_source_unit": "Rent per square meter",
      "rent_source": "sources/showroom_sites.csv",
      "source_surveyed_at": "2026-09-01",
      "surveyed_at": "2026-09-15T18:00:00+03:00",
      "supersedes": null,
      "source_row": ["2026-09-01", "FL-02", "Old Portbell Road Industrial area, Wankoko (Bugolobi)", "BE FORWARD-MEIK CAR HUB", "Lead", "365m2", "$9", ""]
    }'::jsonb,
   'migration', '11111111-1111-1111-1111-111111111111', '2026-09-15 18:00:00+03')
on conflict (id) do nothing;
commit;
