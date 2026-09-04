# TASK-005：存量数据导入 D4 + 对账（migrate_data.mjs / reconcile.mjs）
状态：TODO（前置：TASK-004）
目标：Sheet 双表+survey_points.json+fengshui_evals.json → PG 全量导入，svc_migration 会话（SET app.migration='on'），历史 log 回填（action='migration'、at=Sheet Added），对账 rows_match:true
输入：docs/Design/02-Database.md §八 D4（svc_migration/回滚删除顺序）；§三 3.4/3.5/3.7/3.9；docs/Design/03-API.md §三（口径参考）；主线仓 survey_writeback.gs（列语义）；docs/Design/04-Module.md M-Mig
验收条件：
1. `migrate_data.mjs --dry-run` 出映射报告不写库；正式跑幂等（连跑两遍第二遍零新增）
2. 导入范围：site（含 archived 退役点）+survey_result(source='migration')+fengshui_eval+历史 log 回填；归属署名全为 svc_migration
3. `reconcile.mjs` 输出 `rows_match:true` 报告存档（行数一致 ∧ 每行关键字段拼接 sha1 一致，双表各自算）
4. 人为改一行源→rows_match:false 且差异行被点名（负向用例）
5. 回滚路径演练一次：按删除顺序 photo→survey_result→fengshui_eval→site_status_log(actor=svc_migration)→site 清空迁移数据，再整体重跑
审查结论：（完工时填）
