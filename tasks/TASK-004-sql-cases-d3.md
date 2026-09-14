# TASK-004：D3 SQL 用例全绿（sql_cases.sql）
状态：DONE（2026-09-14；两遍执行 28/28 全 PASS，机器证据 docs/features/v1-launch/evidence-task004/）
目标：02 §八 D3 用例集全绿——三角色矩阵/状态机合法与非法转换/GUC 闸回归/触发器断言/跨项目隔离/匿名零权限
输入：docs/Design/02-Database.md §五 RLS 矩阵、§六 触发器与 RPC、§八 D3；docs/Design/04-Module.md M-Mig sql_cases.sql
验收条件：
1. `sql_cases.sql` psql 跑全绿（每用例 PASS/FAIL 断言行），覆盖：①三角色×操作矩阵（R4：surveyor 写 own-only/读非 archived 全量）②状态机合法转换+非法转换拒（R2）③**manager 直改 status 被 GUC 闸拒（H3 回归）**④RPC 越权拒/角色不足拒⑤首条 submit log+audit old→new（R8）⑥跨项目隔离（R17）⑦匿名零权限（N1）⑧COALESCE 闸：文本列 null 不覆盖/lat/lon 显式 null 清空（R2）
2. 用例含 svc_migration 会话路径（SET app.migration='on' 旁路仅迁移会话生效断言）
3. 全部用例纳入可重复执行（同库重跑全绿）
审查结论：✅ 两遍执行 28/28 全 PASS（d3_run1.log / d3_run2.log；28 个判分行覆盖 22 个编号用例族——T05a/b、T17a/b/c、T19a/b 为拆分断言）。
- 执行通道：本机无 psql → Management API /database/query 适配器（evidence-task004/sql_cases_api.sql 存档）：剥离 psql `\set` 行、rollback 提至批尾（temp 判分表随事务消亡，判分以批内 select count 返回为准）；单次 POST=单连接，begin/rollback 语义不变
- 前置完成：domain_config **v2 已入库**（从在用 survey_form.html 机械提取：survey 14 字段/verify 8 字段/groups A-B-C/P1-P4 拍照指引；v1 占位留档；**用户复核待补——追加制，如有出入以 v3 修订**）
- 踩坑修复（承接 TASK-003 实测）：①`site_status_log.site_id` FK 改 deferrable initially deferred（BEFORE 触发器先写日志，原 FK 即时检查必炸——0001 与 02-Database 已同步）②`pg_temp.record()` 加 security definer（become() 切角色后 invoker 权限写不进判分表）
- 验收 3：同库连跑两遍全绿（fixture on conflict + 整体 rollback，零残留）
