-- sql_cases.sql — D3 acceptance suite (TASK-004; 02-Database v1.2 §八 D3)
-- Run after migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/sql_cases.sql
-- Green = verdict 无异常 + 批内 count 行 total==passed（psql exit 0 同义；API 适配版同）。
-- 外审后扩充：T23-T27（site/fengshui 冒名、迁移 audit actor、domain_config v2）；判分行动态计数。
-- Runs as service role; simulates users via SET ROLE + request.jwt.claims.
-- One transaction; all fixtures rolled back at the end.
-- NOTE: GUCs are set session-scoped (is_local=false) and explicitly reset,
-- because transaction-local GUCs survive plpgsql subtransaction exits.


begin;

create temp table t_result (name text primary key, pass boolean, detail text default '');

create or replace function pg_temp.record(t text, ok boolean, d text default '') returns void
language plpgsql security definer as $$  -- definer: become() 切角色后仍以迁移属主写判分表
begin
  insert into t_result (name, pass, detail) values (t, ok, d)
  on conflict (name) do update set pass = excluded.pass, detail = excluded.detail;
end $$;

-- identity helpers ------------------------------------------------------------
create or replace function pg_temp.become(u uuid) returns void
language sql as $$
  select set_config('role', 'authenticated', false),
         set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
$$;

create or replace function pg_temp.become_anon() returns void
language sql as $$
  select set_config('role', 'anon', false),
         set_config('request.jwt.claims', '', false);
$$;

create or replace function pg_temp.clear() returns void
language sql as $$
  select set_config('role', 'none', false),
         set_config('request.jwt.claims', '', false);
$$;

create or replace function pg_temp.guc(k text, v text) returns void
language sql as $$
  select set_config(k, v, false);
$$;

-- fixed ids -------------------------------------------------------------------
-- users:   aaaaaaaa-...-01 admin / -02 manager / -03 surveyor S1 / -04 surveyor S2
-- sites:   cccccccc-...-01 X1=P1/SP-TEST-1(by mgr)  -02 X2=P2/SP-TEST-1(by mgr)
--          cccccccc-...-03 X3=P1/SP-TEST-2(by S1)   -04 X4=S1-inserted (T01)
--          cccccccc-...-06 X6=migration-imported archived
-- srs:     dddddddd-...-01 (by mgr on X1) / -03 (by S1 on X3)

-- ===== fixtures (service role; GUC so trigger-written logs get an actor) =====
select pg_temp.guc('app.actor_uuid', '11111111-1111-1111-1111-111111111111');

insert into public.app_user (id, display_name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin_test', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'mgr_test',   'manager'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'svy1_test',  'surveyor'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'svy2_test',  'surveyor')
on conflict (id) do nothing;

insert into public.project (id, code, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'test-p1', 'P1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'test-p2', 'P2')
on conflict (code) do nothing;

insert into public.site (id, project_id, code, name, grp, address, lat, lon, created_by) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'SP-TEST-1', 'X1', 'Ntinda', 'addr1', 0.35, 32.61, 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'SP-TEST-1', 'X2', 'Kansanga', 'addr2', null, null, 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'SP-TEST-2', 'X3', null, null, null, null, 'aaaaaaaa-0000-0000-0000-000000000003');

insert into public.survey_result (id, site_id, rent, created_by, source) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 100, 'aaaaaaaa-0000-0000-0000-000000000002', 'form'),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003', 300, 'aaaaaaaa-0000-0000-0000-000000000003', 'form');

-- ===== A. baseline: insert / visibility / own-rows / COALESCE / GUC gate =====

-- T01 surveyor inserts site -> surveying + first submit log (actor = surveyor)
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  insert into public.site (id, project_id, code, name, lat, lon)
  values ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001',
          'SP-TEST-3', 'X4', 0.3476, 32.5825);
  perform pg_temp.clear();
  select count(*) into n from public.site_status_log
  where site_id = 'cccccccc-0000-0000-0000-000000000004'
    and action = 'submit' and from_status is null and to_status = 'surveying'
    and actor = 'aaaaaaaa-0000-0000-0000-000000000003';
  perform pg_temp.record('T01 surveyor 建点+首条 submit log', n = 1, 'logs=' || n);
end $$;

-- T21 geog generated column matches lat/lon (D1 L5 sanity)
do $$ declare v_lat double precision; begin
  select st_y(geog::geometry) into v_lat
  from public.site where id = 'cccccccc-0000-0000-0000-000000000004';
  perform pg_temp.record('T21 geog 生成列', abs(v_lat - 0.3476) < 1e-9, 'st_y=' || v_lat);
end $$;

-- T02 surveyor reads all non-archived sites across projects (H1 口径)
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  select count(*) into n from public.site;
  perform pg_temp.record('T02 surveyor 读非 archived 全量(4)', n = 4, 'rows=' || n);
end $$;

-- T05a surveyor updates own row basic field
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  with u as (update public.site set name = 'X3-renamed'
             where id = 'cccccccc-0000-0000-0000-000000000003' returning 1)
  select count(*) into n from u;
  perform pg_temp.record('T05a surveyor 改自己行', n = 1, 'rows=' || n);
end $$;

-- T05b surveyor updates manager-created row -> invisible for UPDATE (0 rows)
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  with u as (update public.site set name = 'hack'
             where id = 'cccccccc-0000-0000-0000-000000000001' returning 1)
  select count(*) into n from u;
  perform pg_temp.record('T05b surveyor 改他人行=0行', n = 0, 'rows=' || n);
end $$;

-- T06 surveyor inserts survey_result claiming another's created_by -> with check 拒
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
    insert into public.survey_result (id, site_id, created_by)
    values ('dddddddd-0000-0000-0000-000000000009',
            'cccccccc-0000-0000-0000-000000000004',
            'aaaaaaaa-0000-0000-0000-000000000002');
    perform pg_temp.record('T06 sr 冒名 created_by 被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T06 sr 冒名 created_by 被拒', true, sqlerrm);
  end;
end $$;

-- T04 surveyor sees only own survey_result (manager's sr invisible)
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  select count(*) into n from public.survey_result
  where id = 'dddddddd-0000-0000-0000-000000000001';
  perform pg_temp.record('T04 surveyor 看不到他人 sr', n = 0, 'rows=' || n);
end $$;

-- T18 surveyor flips own sr source form->migration -> with check 拒
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
    update public.survey_result set source = 'migration'
    where id = 'dddddddd-0000-0000-0000-000000000003';
    perform pg_temp.record('T18 sr source 翻转被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T18 sr source 翻转被拒', true, sqlerrm);
  end;
end $$;

-- T17 COALESCE guard: null does NOT clear text cols; lat/lon explicit null DOES clear
do $$ declare v_grp text; v_addr text; v_lat double precision; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  update public.site set grp = null, address = null, lat = null
  where id = 'cccccccc-0000-0000-0000-000000000004';
  select grp, address, lat into v_grp, v_addr, v_lat
  from public.site where id = 'cccccccc-0000-0000-0000-000000000004';
  perform pg_temp.record('T17a grp/address null 不覆盖', v_grp = 'Ntinda' or v_grp is null,
                         'grp=' || coalesce(v_grp, '∅'));
  perform pg_temp.record('T17b lat 显式 null 清空', v_lat is null, 'lat=' || coalesce(v_lat::text, '∅'));
end $$;
-- (X4 was inserted without grp/address, so its null-over-null is trivially kept;
--  X1 exercises the non-trivial branch from the manager side below)

do $$ declare v_grp text; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  update public.site set grp = null where id = 'cccccccc-0000-0000-0000-000000000001';
  select grp into v_grp from public.site where id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.record('T17c mgr 改 X1 grp=null 仍为 Ntinda', v_grp = 'Ntinda', 'grp=' || coalesce(v_grp, '∅'));
end $$;

-- T20 empty string DOES clear text col
do $$ declare v_addr text; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  update public.site set address = '' where id = 'cccccccc-0000-0000-0000-000000000001';
  select address into v_addr from public.site where id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.record('T20 空串清空 address', v_addr = '', 'addr=' || quote_nullable(v_addr));
end $$;

-- T07 manager DIRECT status PATCH -> GUC gate rejects (H3 regression)
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
    update public.site set status = 'selected'
    where id = 'cccccccc-0000-0000-0000-000000000001';
    perform pg_temp.record('T07 manager 直改 status 被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T07 manager 直改 status 被拒', true, sqlerrm);
  end;
end $$;

-- ===== B. state machine via RPC =====

-- T08 approve surveying->candidate (manager) + log + status
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  perform public.approve_site('cccccccc-0000-0000-0000-000000000001', 'candidate', 'ok');
  perform pg_temp.clear();
  select count(*) into n from public.site_status_log
  where site_id = 'cccccccc-0000-0000-0000-000000000001'
    and action = 'approve_candidate' and from_status = 'surveying' and to_status = 'candidate';
  perform pg_temp.record('T08 RPC approve→candidate+log', n >= 1, 'logs=' || n);
end $$;

-- T09 approve candidate->selected
do $$ declare v_st text; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  perform public.approve_site('cccccccc-0000-0000-0000-000000000001', 'selected', null);
  perform pg_temp.clear();
  select status::text into v_st from public.site where id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.record('T09 RPC approve→selected', v_st = 'selected', 'status=' || v_st);
end $$;

-- T10 illegal transition selected->candidate -> reject
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
    perform public.approve_site('cccccccc-0000-0000-0000-000000000001', 'candidate', null);
    perform pg_temp.record('T10 非法转换 selected→candidate 拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T10 非法转换 selected→candidate 拒', true, sqlerrm);
  end;
end $$;

-- T11 hide (manager) -> archived + log
do $$ declare v_st text; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  perform public.hide_site('cccccccc-0000-0000-0000-000000000001', '否决');
  perform pg_temp.clear();
  select status::text into v_st from public.site where id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.record('T11 RPC hide→archived', v_st = 'archived', 'status=' || v_st);
end $$;

-- T03 archived visibility: manager sees it, surveyor does not (H1/R4)
do $$ declare v_mgr boolean; v_svy boolean; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  select exists (select 1 from public.site where id = 'cccccccc-0000-0000-0000-000000000001') into v_mgr;
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  select exists (select 1 from public.site where id = 'cccccccc-0000-0000-0000-000000000001') into v_svy;
  perform pg_temp.record('T03 archived 可见性 mgr✓/svy✗', v_mgr and not v_svy,
                         'mgr=' || v_mgr || ',svy=' || v_svy);
end $$;

-- T12 restore: manager denied; admin restores to last-hide from_status (=selected)
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
    perform public.restore_site('cccccccc-0000-0000-0000-000000000001', null);
    perform pg_temp.record('T12a manager 恢复被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T12a manager 恢复被拒', true, sqlerrm);
  end;
end $$;

do $$ declare v_st text; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');
  perform public.restore_site('cccccccc-0000-0000-0000-000000000001', '恢复');
  perform pg_temp.clear();
  select status::text into v_st from public.site where id = 'cccccccc-0000-0000-0000-000000000001';
  perform pg_temp.record('T12b admin 恢复→selected', v_st = 'selected', 'status=' || v_st);
end $$;

-- T13 surveyor calls approval RPC -> 权限不足
do $$ begin
  begin
    perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
    perform public.approve_site('cccccccc-0000-0000-0000-000000000004', 'candidate', null);
    perform pg_temp.record('T13 surveyor RPC 被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T13 surveyor RPC 被拒', true, sqlerrm);
  end;
end $$;

-- ===== C. audit / cross-project / anon / migration path =====

-- T14 audit_log: site UPDATE recorded with old->new (R8)
do $$ declare n int; begin
  select count(*) into n from public.audit_log
  where table_name = 'site' and op = 'UPDATE'
    and new_data ->> 'id' = 'cccccccc-0000-0000-0000-000000000003'
    and old_data ->> 'name' = 'X3' and new_data ->> 'name' = 'X3-renamed';
  perform pg_temp.record('T14 audit old→new', n >= 1, 'rows=' || n);
end $$;

-- T15 cross-project: same code in P1+P2 coexists; project_id filter isolates (R17/R6)
do $$ declare n_all int; n_p1 int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  select count(*) into n_all from public.site where code = 'SP-TEST-1';
  select count(*) into n_p1 from public.site
  where code = 'SP-TEST-1' and project_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  perform pg_temp.record('T15 跨项目同 code+隔离', n_all = 2 and n_p1 = 1,
                         'all=' || n_all || ',p1=' || n_p1);
end $$;

-- T22 surveyor queries archived by code -> 0 rows (RLS); manager -> 1 (R3 依赖行为)
do $$ declare v_st int; v_m int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  perform public.hide_site('cccccccc-0000-0000-0000-000000000002', 'T22');
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  select count(*) into v_st from public.site
  where code = 'SP-TEST-1' and status = 'archived';
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
  select count(*) into v_m from public.site
  where code = 'SP-TEST-1' and status = 'archived';
  perform pg_temp.record('T22 archived 预检 svy=0/mgr=1', v_st = 0 and v_m = 1,
                         'svy=' || v_st || ',mgr=' || v_m);
end $$;

-- T16 anon: zero read, insert denied (N1)
do $$ declare n int; begin
  begin
    perform pg_temp.become_anon();
    select count(*) into n from public.site;
    perform pg_temp.record('T16a anon 读=0', n = 0, 'rows=' || n);
  exception when others then
    perform pg_temp.record('T16a anon 读=0', false, sqlerrm);
  end;
  begin
    insert into public.site (id, project_id, code, name)
    values ('cccccccc-0000-0000-0000-000000000009',
            'bbbbbbbb-0000-0000-0000-000000000001', 'ANON', 'anon');
    perform pg_temp.record('T16b anon 写被拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T16b anon 写被拒', true, sqlerrm);
  end;
end $$;

-- T19 migration path: app.migration='on' imports archived w/ backdated log;
--     without the GUC it must fail (D4旁路仅迁移会话)
do $$ declare v_act text; v_at timestamptz; begin
  perform pg_temp.clear();
  perform pg_temp.guc('app.migration', 'on');
  perform pg_temp.guc('app.actor_uuid', '11111111-1111-1111-1111-111111111111');
  insert into public.site (id, project_id, code, name, status, created_by, created_at)
  values ('cccccccc-0000-0000-0000-000000000006',
          'bbbbbbbb-0000-0000-0000-000000000001', 'SP-TEST-MIG', 'X6', 'archived',
          '11111111-1111-1111-1111-111111111111', '2026-05-01 10:00+00');
  select action, at into v_act, v_at from public.site_status_log
  where site_id = 'cccccccc-0000-0000-0000-000000000006' limit 1;
  perform pg_temp.record('T19a 迁移旁路 archived+log@Added',
                         v_act = 'migration' and date_trunc('day', v_at) = '2026-05-01',
                         'action=' || coalesce(v_act, '∅') || ',at=' || coalesce(v_at::text, '∅'));
  perform pg_temp.guc('app.migration', 'off');
  perform pg_temp.guc('app.actor_uuid', '');
  begin
    insert into public.site (id, project_id, code, name, status, created_by)
    values ('cccccccc-0000-0000-0000-000000000007',
            'bbbbbbbb-0000-0000-0000-000000000001', 'SP-TEST-MIG2', 'X7', 'archived',
            '11111111-1111-1111-1111-111111111111');
    perform pg_temp.record('T19b 无 GUC 建 archived 拒', false, 'no exception');
  exception when others then
    perform pg_temp.record('T19b 无 GUC 建 archived 拒', true, sqlerrm);
  end;
end $$;

-- ===== 外审扩充（CHANGES REQUIRED 处置：0003 收紧后的归属/审计/配置断言） =====

-- T23 site 冒名 created_by（S2 以 S1 名义建点）-> 0003 with check 拒
do $$ begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000004');
  insert into public.site (id, project_id, code, name, created_by)
  values ('cccccccc-0000-0000-0000-000000000008',
          'bbbbbbbb-0000-0000-0000-000000000001', 'SP-TEST-FORGE', 'X8',
          'aaaaaaaa-0000-0000-0000-000000000003');
  perform pg_temp.record('T23 site 冒名 created_by 拒', false, 'no exception');
exception when others then
  perform pg_temp.record('T23 site 冒名 created_by 拒', true, sqlerrm);
end $$;

-- T24 fengshui 冒名+越站点（S2 在 S1 的点上挂他人 created_by）-> 拒
do $$ begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000004');
  insert into public.fengshui_eval (id, site_id, raw, created_by)
  values ('eeeeeeee-0000-0000-0000-000000000001',
          'cccccccc-0000-0000-0000-000000000003', '{}'::jsonb,
          'aaaaaaaa-0000-0000-0000-000000000003');
  perform pg_temp.record('T24 fengshui 冒名+越站点 拒', false, 'no exception');
exception when others then
  perform pg_temp.record('T24 fengshui 冒名+越站点 拒', true, sqlerrm);
end $$;

-- T25 fengshui 正路径（S1 在自己的点上挂自己的评估）-> 允许
do $$ declare n int; begin
  perform pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
  insert into public.fengshui_eval (id, site_id, raw, created_by)
  values ('eeeeeeee-0000-0000-0000-000000000002',
          'cccccccc-0000-0000-0000-000000000003', '{"note":"self ok"}'::jsonb,
          'aaaaaaaa-0000-0000-0000-000000000003');
  select count(*) into n from public.fengshui_eval
  where id = 'eeeeeeee-0000-0000-0000-000000000002';
  perform pg_temp.record('T25 fengshui 正路径可写', n = 1, 'rows=' || n);
end $$;

-- T26 迁移会话 audit actor 回落 app.actor_uuid（0003 口径对齐）
do $$ declare v_actor uuid; begin
  perform pg_temp.clear();
  select actor into v_actor from public.audit_log
  where table_name = 'site' and row_id = 'cccccccc-0000-0000-0000-000000000006'
  order by at desc limit 1;
  perform pg_temp.record('T26 迁移 audit actor 回落 svc',
                         v_actor = '11111111-1111-1111-1111-111111111111',
                         'actor=' || coalesce(v_actor::text, '∅'));
end $$;

-- T27 domain_config v2 存在且非占位（外审账实不一致回归）
do $$ declare n int; v_todo text; begin
  perform pg_temp.clear();
  select count(*) into n from public.domain_config dc where dc.version = 2;
  select coalesce(dc.config->>'_todo', '') into v_todo
    from public.domain_config dc where dc.version = 2;
  perform pg_temp.record('T27 domain_config v2 非占位', n = 1 and v_todo = '',
                         'rows=' || n || ',_todo=' || coalesce(v_todo, '∅'));
end $$;

-- ===== verdict =====
do $$ begin
  if exists (select 1 from pg_temp.t_result where not pass) then
    raise exception 'D3 FAILURES: %', (select string_agg(name, ' | ') from pg_temp.t_result where not pass);
  end if;
end $$;

select count(*) as total, count(*) filter (where pass) as passed from t_result;

rollback;