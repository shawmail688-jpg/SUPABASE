-- 0001_d1_schema.sql — D1: enums + 10 tables + indexes + geog generated column
-- Source of truth: docs/Design/02-Database.md v1.2 (L2 Lock). TASK-003.
-- L5 day-1 check: if the ::geography generated column is rejected (cast not
-- IMMUTABLE on this PostGIS version), fall back to a trigger-maintained column
-- and record the decision in ADR-001 变更记录 before proceeding.

create extension if not exists postgis;

create type public.site_status as enum ('surveying','candidate','selected','archived','operating');
create type public.app_role    as enum ('manager','surveyor','admin');

-- 3.1 project (replication axis)
create table public.project (
  id          uuid primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.3 app_user (id = auth.users.id; exception R7: svc_migration machine account
--      has NO auth.users row — seeded with fixed uuid in 0002)
create table public.app_user (
  id           uuid        primary key,
  display_name text        not null,
  role         public.app_role not null default 'surveyor',
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3.2 domain_config (append-only, R5: version increments; old rows never updated)
create table public.domain_config (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.project(id) on delete restrict,
  version    int         not null,
  config     jsonb       not null default '{}'::jsonb,
  created_by uuid        references public.app_user(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

-- 3.4 site (one row = one real storefront / candidate location)
create table public.site (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.project(id) on delete restrict,
  code       text        not null,
  name       text        not null,
  grp        text,
  address    text,
  lat        double precision,
  lon        double precision,
  geog       geography(point,4326) generated always as (
    case when lat is not null and lon is not null
         then st_setsrid(st_makepoint(lon, lat), 4326)::geography
    end
  ) stored,
  status     public.site_status not null default 'surveying',
  -- R2/COALESCE scope: text cols guarded in trigger; lat/lon explicit null = clear
  created_by uuid        not null references public.app_user(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);
create index site_geog_idx           on public.site using gist (geog);
create index site_project_status_idx on public.site (project_id, status);

-- 3.5 survey_result (append-only survey history)
create table public.survey_result (
  id            uuid        primary key,          -- client-pregenerated (offline idempotency, M3)
  site_id       uuid        not null references public.site(id) on delete restrict,
  rent          numeric,
  space         numeric,
  contact       text,
  surveyor_name text,
  added_date    date,
  raw           jsonb       not null default '{}'::jsonb,   -- full form payload (domain_config)
  source        text        not null default 'form'
                            check (source in ('form','migration','appscript')),
  created_by    uuid        not null references public.app_user(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index survey_result_site_created_idx on public.survey_result (site_id, created_at desc);

-- 3.6 photo (metadata only; object lives in Storage private bucket)
create table public.photo (
  id               uuid        primary key,      -- client-pregenerated (M3)
  site_id          uuid        not null references public.site(id) on delete restrict,
  survey_result_id uuid        references public.survey_result(id) on delete set null,
  storage_path     text        not null unique,  -- {project_code}/{site_code}/{sha1}.jpg
  sha1             char(40)    not null unique,  -- content addressing / dedup
  kind             text        not null default 'normal' check (kind in ('normal','detail')),
  taken_at         timestamptz,
  uploaded_by      uuid        not null references public.app_user(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index photo_site_idx on public.photo (site_id);

-- 3.7 site_status_log (single source of truth for state transitions)
create table public.site_status_log (
  id          bigint generated always as identity primary key,
  site_id     uuid        not null references public.site(id) on delete restrict,
  from_status public.site_status,                   -- NULL = first creation
  to_status   public.site_status not null,
  action      text        not null check (action in
              ('submit','approve_candidate','approve_selected','hide','restore','migration')),
  actor       uuid        not null references public.app_user(id) default auth.uid(),
  at          timestamptz not null default now(),
  note        text
);
create index site_status_log_site_at_idx on public.site_status_log (site_id, at);

-- 3.8 external_ids (mapping-table landing; v1 = structure only)
create table public.external_ids (
  id              uuid        primary key default gen_random_uuid(),
  entity_type     text        not null check (entity_type in ('store','survey_point','device')),
  entity_id       uuid        not null,
  external_system text        not null,
  external_id     text        not null,
  added_by        uuid        references public.app_user(id) default auth.uid(),
  added_at        timestamptz not null default now(),
  unique (external_system, entity_type, external_id)
);

-- 3.9 fengshui_eval (migrated from fengshui_evals.json)
create table public.fengshui_eval (
  id         uuid        primary key default gen_random_uuid(),
  site_id    uuid        not null references public.site(id) on delete restrict,
  raw        jsonb       not null,
  created_by uuid        references public.app_user(id) default auth.uid(),  -- nullable: service sessions
  created_at timestamptz not null default now()
);

-- 3.10 audit_log (trigger-written, client read-only for admin; append-only)
create table public.audit_log (
  id        bigint generated always as identity primary key,
  table_name text       not null,
  op         text       not null check (op in ('INSERT','UPDATE')),
  row_id     uuid,
  old_data   jsonb,
  new_data   jsonb,
  actor      uuid,                                     -- null = service session
  at         timestamptz not null default now()
);
create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
