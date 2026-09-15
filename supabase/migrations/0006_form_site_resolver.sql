-- TASK-008: atomic form-side site resolution with archived-site defence.
-- SECURITY DEFINER is required because surveyors cannot SELECT archived sites,
-- but the form must distinguish "hidden" from "not found" before inserting.
create or replace function public.resolve_form_site(
  p_project_code text,
  p_site_code text,
  p_name text,
  p_group text default null,
  p_address text default null
)
returns table(site_id uuid, site_status public.site_status, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project uuid;
  v_site public.site%rowtype;
  v_constraint text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.app_user u where u.id = auth.uid() and u.is_active
  ) then
    raise exception 'active authenticated user required' using errcode = '42501';
  end if;

  select p.id into v_project
  from public.project p
  where p.code = p_project_code and p.is_active;
  if v_project is null then
    raise exception 'project not found or inactive' using errcode = 'P0002';
  end if;

  select s.* into v_site
  from public.site s
  where s.project_id = v_project and s.code = p_site_code;

  if found then
    return query select v_site.id, v_site.status, false;
    return;
  end if;

  begin
    insert into public.site(project_id, code, name, grp, address, status, created_by)
    values (v_project, p_site_code, p_name, p_group, p_address, 'surveying', auth.uid())
    returning * into v_site;
    return query select v_site.id, v_site.status, true;
  exception when unique_violation then
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint <> 'site_project_id_code_key' then
      raise;
    end if;
    select s.* into v_site
    from public.site s
    where s.project_id = v_project and s.code = p_site_code;
    if not found then
      raise exception 'site conflict could not be resolved' using errcode = '40001';
    end if;
    return query select v_site.id, v_site.status, false;
  end;
end;
$$;

revoke all on function public.resolve_form_site(text,text,text,text,text) from public;
grant execute on function public.resolve_form_site(text,text,text,text,text) to authenticated;

comment on function public.resolve_form_site(text,text,text,text,text) is
  'Atomic form site resolver. Returns archived status so clients refuse survey submission.';
