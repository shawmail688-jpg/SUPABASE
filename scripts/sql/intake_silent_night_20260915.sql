-- Raymond live intake: Silent Night, deduplicated from repeated identical Sheet rows.
-- Google Maps share link supplied/confirmed by the user on 2026-09-15.
-- Coordinates resolved from the share link; Kampala bounding-box check passed.
begin;

select set_config('app.actor_uuid', '11111111-1111-1111-1111-111111111111', true);

update public.site
set address = 'Parliamentary avenue slightly off Kampala Road',
    lat = 0.3139017,
    lon = 32.588439
where id = '43e2e6db-9be5-5d87-a23a-d608ef371173'
  and code = 'SR-SILENT-NIGHT';

insert into public.external_ids
  (entity_type, entity_id, external_system, external_id, added_by)
values
  ('store', '43e2e6db-9be5-5d87-a23a-d608ef371173', 'google_maps_share',
   'https://maps.app.goo.gl/qu3oy5bgxsJyTAiA8', '11111111-1111-1111-1111-111111111111')
on conflict (external_system, entity_type, external_id) do nothing;

insert into public.survey_result
  (id, site_id, rent, space, contact, surveyor_name, added_date, raw, source, created_by, created_at)
values
  ('3891cbe6-5328-55e7-9cde-35c3ee541f54',
   '43e2e6db-9be5-5d87-a23a-d608ef371173',
   3960, null, 'Vianney 0753 823625', 'Raymond', '2026-09-14',
   '{
      "type": "L",
      "currency": "USD",
      "space_band": "lt300",
      "location_pin": "https://maps.app.goo.gl/qu3oy5bgxsJyTAiA8",
      "resolved_coordinates": {"lat": 0.3139017, "lon": 32.588439},
      "surveyed_at": "2026-09-14T12:00:00+03:00",
      "surveyed_at_precision": "date",
      "supersedes": null,
      "source_row_sha256": "e0a2f071a41b3488da06b83128dc98011a56fc4802d8baa52e381d69cd2d1456",
      "source_row": ["2026-09-14","FL-01","Parliamentary avenue slightly off kampala road","Silent night","Lead","lt300","3960","Vianney 0753 823625","https://maps.app.goo.gl/qu3oy5bgxsJyTAiA8",""," [photos: P1]"]
    }'::jsonb,
   'appscript', '11111111-1111-1111-1111-111111111111', '2026-09-14 12:00:00+03')
on conflict (id) do nothing;

update public.photo
set survey_result_id = '3891cbe6-5328-55e7-9cde-35c3ee541f54'
where site_id = '43e2e6db-9be5-5d87-a23a-d608ef371173'
  and sha1 = 'c524f845a104dcb11e0dd9ebb15e763a929ee58a';

commit;
