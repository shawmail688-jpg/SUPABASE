# TASK-003：建库迁移 SQL（D1 表结构 + D2 RLS/触发器/RPC/种子）
状态：DONE（2026-09-14；四项验收全 PASS，机器证据 docs/features/v1-launch/evidence-task003/）
目标：`supabase/migrations/NNN_*.sql` 纯 SQL 落地 02-Database 全部对象：D1 枚举+10 表+索引+geog 生成列；D2 REVOKE DELETE+RLS 矩阵+辅助函数+触发器（definer 钉 search_path）+RPC 三支+种子数据（project/domain_config/app_user+svc_migration）
输入：docs/Design/02-Database.md §一/§二/§三/§五/§六/§八 D1-D2（Lock v1.2）
验收条件：
1. 迁移文件按序重放成功两遍（第二遍幂等零报错）——psql 或 supabase db push 输出留痕
2. geog 生成列建成（IMMUTABLE 验证；被拒则降级触发器维护列，决策记 ADR-001 变更记录）
3. information_schema 断言：10 表/索引/触发器/RPC 函数齐全；REVOKE DELETE 生效（has_table_privilege 查询输出）
4. 回滚脚本可执行（drop 顺序=依赖逆序）
审查结论：✅ 四项全 PASS（2026-09-14，执行通道=PAT → Management API /database/query，替代 psql——本机无 psql/docker）。
- 验收 1：0001+0002 首次应用 201 → 幂等重放零报错 201（migrate.log；0001 已在 day-1 试跑过一次，仍重放通过）
- 验收 2：site.geog = `generated always as ... stored` 建成（geog_always=1）；st_setsrid/st_makepoint provolatile 全 'i'（geog_immutable=true），无需触发器降级
- 验收 3：断言 12/12 PASS（asserts.json）：10 表 / RLS 启用 10 / 命名索引 6 / 触发器 12 / 函数 8（三 RPC+5 辅助）/ REVOKE DELETE 对 anon+authenticated 全表拒绝 / 种子三条（project uganda-showroom、svc_migration 固定 uuid、domain_config v1）
- 验收 4：回滚演练 PASS——执行 rollback_d1_d2.sql（事务包裹、依赖逆序）→ 10 表残留 0 → 重新应用 0001+0002 → 断言复验 12/12（rollback.log）
- 迁移文件幂等化改造（本次实测驱动，入库随本单）：0001 裸 create type×2 → DO duplicate_object 兜底、create table/index 加 if not exists；0002 触发器×12/策略×26 前插 drop if exists——重放零报错的前提
- ⚠ 移交 TASK-004 前置：domain_config v1 仍是占位 config（`_todo: fill from live form fields`）——须先从在用表单抽取真实字段结构回填并通过用户确认，才能过 D3 闸门
执行通道备注：Management API /database/query 多语句整串执行成功返回 **201**（非 200）；本会话曾因断言写 200 误判失败一次。
