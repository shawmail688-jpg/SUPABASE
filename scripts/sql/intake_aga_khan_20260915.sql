-- Raymond recommendation intake: Aga Khan Hospital Space.
-- Source is Raymond's email/photo; no Survey Results row or location pin was found.
-- Coordinates intentionally remain null until this storefront's own Maps link arrives.
begin;

select set_config('app.actor_uuid', '11111111-1111-1111-1111-111111111111', true);

insert into public.site
  (id, project_id, code, name, grp, address, lat, lon, status, created_by, created_at, updated_at)
select
  '5b057cd8-c70f-5090-ac95-57f582de762c', p.id,
  'SR-AGA-KHAN-KAMPALA-ROAD', 'Aga Khan Hospital Space', 'C',
  'Kampala Road, opposite Cham Towers', null, null, 'surveying',
  '11111111-1111-1111-1111-111111111111',
  '2026-09-14 16:28:13+03', '2026-09-14 16:28:13+03'
from public.project p
where p.code = 'uganda-showroom'
on conflict (project_id, code) do nothing;

insert into public.external_ids
  (entity_type, entity_id, external_system, external_id, added_by)
values
  ('store', '5b057cd8-c70f-5090-ac95-57f582de762c', 'gmail_message',
   '1a0a01ad7432830f', '11111111-1111-1111-1111-111111111111')
on conflict (external_system, entity_type, external_id) do nothing;

insert into public.survey_result
  (id, site_id, rent, space, contact, surveyor_name, added_date, raw, source, created_by, created_at)
values
  ('2ff74a08-307e-50ef-8604-67747525be57',
   '5b057cd8-c70f-5090-ac95-57f582de762c',
   null, null, null, 'Raymond', '2026-09-14',
   '{
      "type": "recommendation",
      "currency": "USD",
      "location_pin": null,
      "coordinates_pending": true,
      "surveyed_at": "2026-09-14T16:28:13+03:00",
      "supersedes": null,
      "source": {
        "kind": "raymond_email",
        "message_id": "1a0a01ad7432830f",
        "subject": "Front view of aga khan hospital space along Kampala road opposite cham tower",
        "photo_sha1": "59ae8f6b0fa5f9a8b5e9af71c1db2bb1c6ef6260"
      }
    }'::jsonb,
   'migration', '11111111-1111-1111-1111-111111111111', '2026-09-14 16:28:13+03')
on conflict (id) do nothing;

-- On first execution the photo may not have been uploaded yet. Replaying this
-- idempotent intake after mount_one links the content-addressed photo version.
update public.photo
set survey_result_id = '2ff74a08-307e-50ef-8604-67747525be57'
where site_id = '5b057cd8-c70f-5090-ac95-57f582de762c'
  and sha1 = '59ae8f6b0fa5f9a8b5e9af71c1db2bb1c6ef6260';

commit;
