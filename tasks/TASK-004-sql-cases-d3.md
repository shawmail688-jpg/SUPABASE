# TASK-004：D3 SQL 用例全绿（sql_cases.sql）
状态：TODO（前置：TASK-003；不通过不进 TASK-005）
目标：02 §八 D3 用例集全绿——三角色矩阵/状态机合法与非法转换/GUC 闸回归/触发器断言/跨项目隔离/匿名零权限
输入：docs/Design/02-Database.md §五 RLS 矩阵、§六 触发器与 RPC、§八 D3；docs/Design/04-Module.md M-Mig sql_cases.sql
验收条件：
1. `sql_cases.sql` psql 跑全绿（每用例 PASS/FAIL 断言行），覆盖：①三角色×操作矩阵（R4：surveyor 写 own-only/读非 archived 全量）②状态机合法转换+非法转换拒（R2）③**manager 直改 status 被 GUC 闸拒（H3 回归）**④RPC 越权拒/角色不足拒⑤首条 submit log+audit old→new（R8）⑥跨项目隔离（R17）⑦匿名零权限（N1）⑧COALESCE 闸：文本列 null 不覆盖/lat/lon 显式 null 清空（R2）
2. 用例含 svc_migration 会话路径（SET app.migration='on' 旁路仅迁移会话生效断言）
3. 全部用例纳入可重复执行（同库重跑全绿）
审查结论：（完工时填）
