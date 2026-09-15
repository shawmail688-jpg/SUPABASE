-- TASK-CR-005: separate historical archive visibility from rejection/hide.
-- archived remains visible to authenticated users and on the map; hidden is the
-- manager's rejection/hide state and is excluded from default views.

alter type public.site_status add value if not exists 'hidden';

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
  if v_from is null or v_from not in ('surveying','candidate','selected','archived') then
    raise exception '当前状态 % 不可隐藏', coalesce(v_from::text, '（不存在/不可见）');
  end if;
  insert into public.site_status_log (site_id, from_status, to_status, action, actor, note)
  values (p_site_id, v_from, 'hidden', 'hide', auth.uid(), p_note);
  update public.site set status = 'hidden' where id = p_site_id;
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
  if not exists (select 1 from public.site where id = p_site_id and status = 'hidden') then
    raise exception '仅已隐藏（hidden）的店可恢复';
  end if;
  select l.from_status into v_target
  from public.site_status_log l
  where l.site_id = p_site_id and l.to_status = 'hidden'
  order by l.at desc, l.id desc
  limit 1;
  v_target := coalesce(v_target, 'surveying');
  insert into public.site_status_log (site_id, from_status, to_status, action, actor, note)
  values (p_site_id, 'hidden', v_target, 'restore', auth.uid(), p_note);
  update public.site set status = v_target where id = p_site_id;
end $$;

drop policy if exists site_select on public.site;
create policy site_select on public.site for select to authenticated
  using (status <> 'hidden' or public.is_manager());

drop policy if exists photo_select on public.photo;
create policy photo_select on public.photo for select to authenticated
  using (exists (
    select 1 from public.site s
    where s.id = site_id and (s.status <> 'hidden' or public.is_manager())
  ));
