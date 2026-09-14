-- 0002_d2_rls_functions_rpcs.sql
-- D2: REVOKE DELETE + helpers + triggers + RLS matrix + RPCs + seeds + Storage
-- Source of truth: docs/Design/02-Database.md v1.2 (L2 Lock). TASK-003.
-- SECURITY DEFINER functions pin search_path (M2). GUC gate (H3):
--   app.via_rpc   = 'on'  set inside approval RPCs only
--   app.migration = 'on'  set by migration sessions only (D4)
--   app.actor_uuid        migration sessions only — trigger fallback for
--                         site_status_log.actor (service sessions have no JWT,
--                         auth.uid() = null; 09-04 实现补充, see 02 §八 D4)

-- ===== grants hardening (L2: soft-delete discipline at the grant layer) =====
revoke delete on all tables in schema public from anon, authenticated;

-- ===== helper functions (security definer; RLS recursion guard) =====
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = 'public','auth' as $$
  select exists (
    select 1 from public.app_user u
    where u.id = auth.uid()
      and u.role in ('manager','admin')
      and u.is_active
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = 'public','auth' as $$
  select exists (
    select 1 from public.app_user u
    where u.id = auth.uid() and u.role = 'admin' and u.is_active
  );
$$;

-- ===== updated_at (projection tables only, L1) =====
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_project_updated_at on public.project;
create trigger trg_project_updated_at       before update on public.project       for each row execute function public.set_updated_at();
drop trigger if exists trg_app_user_updated_at on public.app_user;
create trigger trg_app_user_updated_at      before update on public.app_user      for each row execute function public.set_updated_at();
drop trigger if exists trg_site_updated_at on public.site;
create trigger trg_site_updated_at          before update on public.site          for each row execute function public.set_updated_at();
drop trigger if exists trg_survey_result_updated_at on public.survey_result;
create trigger trg_survey_result_updated_at before update on public.survey_result for each row execute function public.set_updated_at();

-- ===== audit trail (R8: old->new on UPDATE; 6 tables) =====
create or replace function public.audit_fn() returns trigger
language plpgsql security definer set search_path = 'public','auth' as $$
begin
  insert into public.audit_log (table_name, op, row_id, old_data, new_data, actor)
  values (
    tg_table_name,
    tg_op,
    (to_jsonb(coalesce(new, old)) ->> 'id')::uuid,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    auth.uid()
  );
  return coalesce(new, old);
end $$;

drop trigger if exists trg_project_audit on public.project;
create trigger trg_project_audit       after insert or update on public.project       for each row execute function public.audit_fn();
drop trigger if exists trg_app_user_audit on public.app_user;
create trigger trg_app_user_audit      after insert or update on public.app_user      for each row execute function public.audit_fn();
drop trigger if exists trg_site_audit on public.site;
create trigger trg_site_audit          after insert or update on public.site          for each row execute function public.audit_fn();
drop trigger if exists trg_survey_result_audit on public.survey_result;
create trigger trg_survey_result_audit after insert or update on public.survey_result for each row execute function public.audit_fn();
drop trigger if exists trg_photo_audit on public.photo;
create trigger trg_photo_audit         after insert or update on public.photo         for each row execute function public.audit_fn();
drop trigger if exists trg_domain_config_audit on public.domain_config;
create trigger trg_domain_config_audit after insert or update on public.domain_config for each row execute function public.audit_fn();

-- ===== app_user column guard: role/is_active admin-only =====
create or replace function public.app_user_guard() returns trigger
language plpgsql security definer set search_path = 'public','auth' as $$
begin
  if not coalesce(public.is_admin(), false) then
    if new.role     is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.id     is distinct from old.id then
      raise exception '仅 admin 可修改 role/is_active（app_user_guard）';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_app_user_guard on public.app_user;
create trigger trg_app_user_guard before update on public.app_user
  for each row execute function public.app_user_guard();

-- ===== site state machine gate (H2/H3 + first-log M2) =====
create or replace function public.site_before_change() returns trigger
language plpgsql security definer set search_path = 'public','auth' as $$
declare
  v_via_rpc boolean := coalesce(current_setting('app.via_rpc',   true) = 'on', false);
  v_migr    boolean := coalesce(current_setting('app.migration', true) = 'on', false);
  v_actor   uuid    := coalesce(auth.uid(),
                        nullif(current_setting('app.actor_uuid', true), '')::uuid);
begin
  if tg_op = 'INSERT' then
    -- ① new sites start surveying (migration may import archived/retired points)
    if new.status <> 'surveying' and not v_migr then
      raise exception '新建 site 状态必须为 surveying（迁移会话除外）';
    end if;
    -- ④ first status log; migration path backfills as action='migration' at=created_at
    --    (D4 sets site.created_at = Sheet Added date; M7: timeline stays truthful)
    insert into public.site_status_log
      (site_id, from_status, to_status, action, actor, at, note)
    values (
      new.id, null, new.status,
      case when v_migr then 'migration' else 'submit' end,
      v_actor,
      case when v_migr then coalesce(new.created_at, now()) else now() end,
      case when v_migr then 'migration import' end
    );
    return new;
  end if;

  -- ② status changes only via RPC or migration session (manager PATCH rejected too, H3)
  if new.status is distinct from old.status and not (v_via_rpc or v_migr) then
    raise exception '状态变更仅允许经审批 RPC（或迁移会话）——状态机唯一入口';
  end if;

  -- ③ COALESCE guard, text columns only (R2: lat/lon explicit null = clear coords)
  new.grp     := coalesce(new.grp,     old.grp);
  new.address := coalesce(new.address, old.address);

  return new;
end $$;

drop trigger if exists trg_site_before_change on public.site;
create trigger trg_site_before_change before insert or update on public.site
  for each row execute function public.site_before_change();

-- ===== approval RPCs (state machine sole write entry, H3) =====
create or replace function public.approve_site(p_site_id uuid, p_to text, p_note text default null)
returns void
language plpgsql security definer set search_path = 'public','auth' as $$
declare
  v_from public.site_status;
begin
  perform set_config('app.via_rpc', 'on', true);
  if not public.is_manager() then
    raise exception '权限不足：仅管理层可审批';
  end if;
  if p_to not in ('candidate','selected') then
    raise exception '非法目标状态：%（仅 candidate/selected）', p_to;
  end if;
  select status into v_from from public.site where id = p_site_id for update;
  if v_from is null then
    raise exception 'site 不存在：%（或不可见）', p_site_id;
  end if;
  if not ( (v_from = 'surveying' and p_to = 'candidate')
        or (v_from = 'candidate' and p_to = 'selected') ) then
    raise exception '非法状态转换：% → %', v_from, p_to;
  end if;
  insert into public.site_status_log (site_id, from_status, to_status, action, actor, note)
  values (p_site_id, v_from, p_to::public.site_status,
          case when p_to = 'candidate' then 'approve_candidate' else 'approve_selected' end,
          auth.uid(), p_note);
  update public.site set status = p_to::public.site_status where id = p_site_id;
end $$;

create or replace function public.hide_site(p_site_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = 'public','auth' as $$
declare
  v_from public.site_status;
begin
  perform set_config('app.via_rpc', 'on', true);
  if not public.is_manager() then
    raise exception '权限不足：仅管理层可隐藏';
  end if;
  select status into v_from from public.site where id = p_site_id for update;
  if v_from is null or v_from not in ('surveying','candidate','selected') then
    raise exception '当前状态 % 不可隐藏', coalesce(v_from::text, '（不存在/不可见）');
  end if;
  insert into public.site_status_log (site_id, from_status, to_status, action, actor, note)
  values (p_site_id, v_from, 'archived', 'hide', auth.uid(), p_note);
  update public.site set status = 'archived' where id = p_site_id;
end $$;

create or replace function public.restore_site(p_site_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = 'public','auth' as $$
declare
  v_target public.site_status;
begin
  perform set_config('app.via_rpc', 'on', true);
  if not public.is_admin() then
    raise exception '权限不足：仅 admin 可恢复';
  end if;
  if not exists (select 1 from public.site where id = p_site_id and status = 'archived') then
    raise exception '仅已隐藏（archived）的店可恢复';
  end if;
  -- restore target = from_status of the LAST hide (to_status='archived'); else surveying
  select l.from_status into v_target
  from public.site_status_log l
  where l.site_id = p_site_id and l.to_status = 'archived'
  order by l.at desc, l.id desc
  limit 1;
  v_target := coalesce(v_target, 'surveying');
  insert into public.site_status_log (site_id, from_status, to_status, action, actor, note)
  values (p_site_id, 'archived', v_target, 'restore', auth.uid(), p_note);
  update public.site set status = v_target where id = p_site_id;
end $$;

-- ===== row level security (all tables; anon = zero) =====
alter table public.project         enable row level security;
alter table public.domain_config   enable row level security;
alter table public.app_user        enable row level security;
alter table public.site            enable row level security;
alter table public.survey_result   enable row level security;
alter table public.photo           enable row level security;
alter table public.site_status_log enable row level security;
alter table public.external_ids    enable row level security;
alter table public.fengshui_eval   enable row level security;
alter table public.audit_log       enable row level security;

-- project / domain_config: read all authenticated; project update admin.
-- domain_config: no client insert/update (append-only R5; new versions via SQL seeds).
drop policy if exists project_select on public.project;
create policy project_select on public.project for select to authenticated using (true);
drop policy if exists project_update on public.project;
create policy project_update on public.project for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists domain_config_select on public.domain_config;
create policy domain_config_select on public.domain_config for select to authenticated using (true);

-- app_user: read all authenticated; update self (display_name, via guard trigger) / admin
drop policy if exists app_user_select on public.app_user;
create policy app_user_select on public.app_user for select to authenticated using (true);
drop policy if exists app_user_update on public.app_user;
create policy app_user_update on public.app_user for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- site: H1 read = all non-archived for authenticated (manager/admin incl. archived);
--       insert authenticated (status forced surveying by trigger); update manager or own rows
drop policy if exists site_select on public.site;
create policy site_select on public.site for select to authenticated
  using (status <> 'archived' or public.is_manager());
drop policy if exists site_insert on public.site;
create policy site_insert on public.site for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists site_update_mgr on public.site;
create policy site_update_mgr on public.site for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
drop policy if exists site_update_own on public.site;
create policy site_update_own on public.site for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- survey_result: manager all; surveyor own (contacts of others are management视野, H1)
drop policy if exists sr_select_mgr on public.survey_result;
create policy sr_select_mgr on public.survey_result for select to authenticated
  using (public.is_manager());
drop policy if exists sr_select_own on public.survey_result;
create policy sr_select_own on public.survey_result for select to authenticated
  using (created_by = auth.uid());
drop policy if exists sr_insert on public.survey_result;
create policy sr_insert on public.survey_result for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists sr_update_own on public.survey_result;
create policy sr_update_own on public.survey_result for update to authenticated
  using (created_by = auth.uid() and source = 'form')
  with check (created_by = auth.uid() and source = 'form');

-- photo: visibility follows site (non-archived; manager incl. archived); insert own
drop policy if exists photo_select on public.photo;
create policy photo_select on public.photo for select to authenticated
  using (exists (
    select 1 from public.site s
    where s.id = site_id and (s.status <> 'archived' or public.is_manager())
  ));
drop policy if exists photo_insert on public.photo;
create policy photo_insert on public.photo for insert to authenticated
  with check (uploaded_by = auth.uid());

-- site_status_log: read manager all / surveyor own-created sites;
-- writes ONLY inside triggers/RPC (security definer = the single RLS exemption, M2)
drop policy if exists ssl_select_mgr on public.site_status_log;
create policy ssl_select_mgr on public.site_status_log for select to authenticated
  using (public.is_manager());
drop policy if exists ssl_select_own on public.site_status_log;
create policy ssl_select_own on public.site_status_log for select to authenticated
  using (exists (
    select 1 from public.site s where s.id = site_id and s.created_by = auth.uid()
  ));

-- fengshui_eval: manager all; surveyor own-created sites; insert authenticated
drop policy if exists fe_select_mgr on public.fengshui_eval;
create policy fe_select_mgr on public.fengshui_eval for select to authenticated
  using (public.is_manager());
drop policy if exists fe_select_own on public.fengshui_eval;
create policy fe_select_own on public.fengshui_eval for select to authenticated
  using (exists (
    select 1 from public.site s where s.id = site_id and s.created_by = auth.uid()
  ));
drop policy if exists fe_insert on public.fengshui_eval;
create policy fe_insert on public.fengshui_eval for insert to authenticated
  with check (auth.uid() is not null);

-- external_ids: manager only (L3)
drop policy if exists ext_select on public.external_ids;
create policy ext_select on public.external_ids for select to authenticated
  using (public.is_manager());
drop policy if exists ext_insert on public.external_ids;
create policy ext_insert on public.external_ids for insert to authenticated
  with check (public.is_manager());
drop policy if exists ext_update on public.external_ids;
create policy ext_update on public.external_ids for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- audit_log: admin read-only
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- ===== Storage: private photos bucket (ADR-004/R4: INSERT prefix check dropped in
--      v1 — reason recorded in 02 §七; private bucket + staff accounts + no upsert) =====
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos_select_authenticated" on storage.objects;
create policy "photos_select_authenticated" on storage.objects for select to authenticated
  using (bucket_id = 'photos');
drop policy if exists "photos_insert_authenticated" on storage.objects;
create policy "photos_insert_authenticated" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

-- ===== seeds (superuser path, L3; run by migration owner — RLS bypassed) =====
insert into public.project (code, name)
values ('uganda-showroom', '乌干达 Showroom 选址')
on conflict (code) do nothing;

-- svc_migration machine account (R7: NO auth.users row; fixed uuid so scripts/.env pin it)
insert into public.app_user (id, display_name, role)
values ('11111111-1111-1111-1111-111111111111', 'svc_migration', 'surveyor')
on conflict (id) do nothing;

-- domain_config v1: placeholder — TASK-003 verification must replace config with the
-- real survey field structure extracted from the live form BEFORE the D3 gate
insert into public.domain_config (project_id, version, config)
select p.id, 1,
       '{"_todo":"fill from live form fields before D3 gate (TASK-003)"}'::jsonb
from public.project p
where p.code = 'uganda-showroom'
on conflict (project_id, version) do nothing;
