-- 0003_pre_d4_hardening.sql — TASK-004 外审（Codex CHANGES REQUIRED）处置
-- 外审条目：domain_config v2 持久化 / site+fengshui INSERT 归属收紧 / audit actor 口径对齐 / restore 行锁
-- 幂等：可安全重放。不修改已落库的 0001/0002（外审纪律）。

-- ===== 1. domain_config v2 持久化（从在用 survey_form.html 机械提取；用户复核后如需修订以 v3 追加） =====
insert into public.domain_config (project_id, version, config)
select p.id, 2,
'{
  "schema_note": "extracted from live field/survey_form.html 2026-09-14; rent=UGX/month; refused flag when landlord declines",
  "groups": {"A": "调查员自选", "B": "领导推荐", "C": "本地同事推荐"},
  "photo_checklist": {
    "p1": "stand across the road: whole frontage AND the road in one shot",
    "p2": "at the doorway, shoot down the road LEFT",
    "p3": "at the doorway, shoot down the road RIGHT",
    "p4": "the OPPOSITE side of the road"
  },
  "tasks": {
    "survey": {"label": "Lead / 扫街", "fields": [
      {"name": "pname", "type": "text", "required": true, "label": "Point name"},
      {"name": "proad", "type": "text", "required": true, "label": "Road / area"},
      {"name": "pin", "type": "text", "label": "Location pin (Google Maps share link)"},
      {"name": "area", "type": "number", "label": "Space (sqm)"},
      {"name": "front", "type": "number", "label": "Frontage width (m)"},
      {"name": "rent", "type": "number", "required": true, "label": "RENT ASKED (UGX per month)"},
      {"name": "refused", "type": "bool", "label": "Rent refused"},
      {"name": "ll", "type": "text", "label": "Landlord / agent name"},
      {"name": "llphone", "type": "text", "label": "Landlord / agent phone"},
      {"name": "p1", "type": "bool", "label": "P1 front + road"},
      {"name": "p2", "type": "bool", "label": "P2 doorway LEFT"},
      {"name": "p3", "type": "bool", "label": "P3 doorway RIGHT"},
      {"name": "p4", "type": "bool", "label": "P4 opposite side"},
      {"name": "notes", "type": "text", "label": "Notes"}]},
    "verify": {"label": "Verify / 核查", "fields": [
      {"name": "bld", "type": "text", "required": true, "label": "Building / shop name"},
      {"name": "road", "type": "text", "required": true, "label": "Road / street"},
      {"name": "area", "type": "number", "label": "Space (sqm)"},
      {"name": "rent", "type": "number", "label": "Rent asked (UGX per month)"},
      {"name": "contact", "type": "text", "label": "Contact person"},
      {"name": "phone", "type": "text", "label": "Phone"},
      {"name": "pin", "type": "text", "label": "Location Pin"},
      {"name": "notes", "type": "text", "label": "Notes"}]}}
}'::jsonb
from public.project p
where p.code = 'uganda-showroom'
on conflict (project_id, version) do update set config = excluded.config;

-- ===== 2. site INSERT 归属收紧（外审#1：调查员可伪造 created_by） =====
drop policy if exists site_insert on public.site;
create policy site_insert on public.site for insert to authenticated
  with check (created_by = auth.uid());

-- ===== 3. fengshui_eval INSERT 归属收紧（外审#1：冒名/挂到他人站点） =====
drop policy if exists fe_insert on public.fengshui_eval;
create policy fe_insert on public.fengshui_eval for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.site s
      where s.id = site_id
        and (s.created_by = auth.uid() or public.is_manager())
    )
  );

-- ===== 4. audit actor 口径对齐（外审：audit actor 回落 app.actor_uuid） =====
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
    coalesce(auth.uid(), nullif(current_setting('app.actor_uuid', true), '')::uuid)
  );
  return coalesce(new, old);
end $$;

-- ===== 5. restore_site 行锁补齐（外审：与 approve/hide 对齐 FOR UPDATE，防并发窗口） =====
create or replace function public.restore_site(p_site_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = 'public','auth' as $$
declare
  v_target public.site_status;
  v_cur    public.site_status;
begin
  perform set_config('app.via_rpc', 'on', true);
  if not public.is_admin() then
    raise exception '权限不足：仅 admin 可恢复';
  end if;
  select status into v_cur from public.site where id = p_site_id for update;
  if v_cur is null or v_cur <> 'archived' then
    raise exception '仅已隐藏（archived）的店可恢复';
  end if;
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
