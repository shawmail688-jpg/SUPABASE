-- rollback_d1_d2.sql — D1/D2 rollback (TASK-003 acceptance #4)
-- Reverse dependency order. Run as service role. NEVER auto-executed:
-- lives in scripts/sql/ (NOT supabase/migrations/) so `supabase db push` won't run it.
-- Storage bucket row is left in place (harmless; remove via Studio if desired).

begin;

-- functions (cascade drops their triggers / dependent policies)
drop function if exists public.approve_site(uuid, text, text) cascade;
drop function if exists public.hide_site(uuid, text) cascade;
drop function if exists public.restore_site(uuid, text) cascade;
drop function if exists public.site_before_change()  cascade;
drop function if exists public.app_user_guard()      cascade;
drop function if exists public.audit_fn()            cascade;
drop function if exists public.set_updated_at()      cascade;
drop function if exists public.is_admin()            cascade;
drop function if exists public.is_manager()          cascade;

-- storage policies
drop policy if exists "photos_select_authenticated" on storage.objects;
drop policy if exists "photos_insert_authenticated" on storage.objects;

-- tables, children first (FK restrict requires it)
drop table if exists public.audit_log        cascade;
drop table if exists public.fengshui_eval    cascade;
drop table if exists public.external_ids     cascade;
drop table if exists public.site_status_log  cascade;
drop table if exists public.photo            cascade;
drop table if exists public.survey_result    cascade;
drop table if exists public.site             cascade;
drop table if exists public.domain_config    cascade;
drop table if exists public.app_user         cascade;
drop table if exists public.project          cascade;

-- enums
drop type if exists public.site_status cascade;
drop type if exists public.app_role    cascade;

commit;
