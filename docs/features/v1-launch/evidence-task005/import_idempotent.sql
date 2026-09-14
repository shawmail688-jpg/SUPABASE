begin;
select set_config('app.migration', 'on', true);
select set_config('app.actor_uuid', '11111111-1111-1111-1111-111111111111', true);

insert into public.site (id, project_id, code, name, address, grp, created_by)
select '5d255ce7-e779-5a96-8468-2c0593468375', (select id from public.project where code = 'uganda-showroom'), 'SR-HERNELY-BUSINESS-PARK', 'Hernely business park', 'Mulwana road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-HERNELY-BUSINESS-PARK');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '2f3718b5-e121-5a8f-af08-0cd1bb49e6b7', (select id from public.project where code = 'uganda-showroom'), 'SR-FORMER-HISENCE-SHOWROOM-', 'Former hisence showroom Plot 7 AK', 'Old portbell road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-FORMER-HISENCE-SHOWROOM-');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '4aaba04f-8ddd-5d04-a51f-17ecede5d5e6', (select id from public.project where code = 'uganda-showroom'), 'SR-FORMER-NEXA-SOLAR', 'Former Nexa solar', 'Old portbell road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-FORMER-NEXA-SOLAR');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '97a85e3e-e7e3-5687-be5c-6090e5572ca9', (select id from public.project where code = 'uganda-showroom'), 'SR-AFFAYO-BUILDING', 'Affayo building', 'Ndeeba, masaka road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-AFFAYO-BUILDING');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '2c02198f-2de8-5f1c-8ea2-a5389b3ce8ff', (select id from public.project where code = 'uganda-showroom'), 'SR-BE-FORWARD-MEIK-CAR-HUB', 'BE FORWARD-MEIK CAR HUB', 'Old Portbell Road Industrial area, Wankoko (Bugolobi)', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-BE-FORWARD-MEIK-CAR-HUB');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '558d5051-7704-5086-b69b-c51709774e7b', (select id from public.project where code = 'uganda-showroom'), 'SR-KAINIU-MOTORS-WAHAB', 'KAINIU MOTORS WAHAB', 'Ndeeba, masaka road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-KAINIU-MOTORS-WAHAB');
insert into public.site (id, project_id, code, name, address, grp, created_by)
select '43e2e6db-9be5-5d87-a23a-d608ef371173', (select id from public.project where code = 'uganda-showroom'), 'SR-SILENT-NIGHT', 'Silent night', 'Parliamentary avenue slightly off kampala road', null, '11111111-1111-1111-1111-111111111111'
where not exists (select 1 from public.site s where s.project_id = (select id from public.project where code = 'uganda-showroom') and s.code = 'SR-SILENT-NIGHT');
commit;