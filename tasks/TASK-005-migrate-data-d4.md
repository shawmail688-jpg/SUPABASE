# TASK-005：存量导入 D4 + 对账（外审重构版）
状态：HOLD（前置 A：CR-003 用户决策；前置 B：依赖审批〔postgres、csv-parse 最小集，批准后建 package.json〕）
目标：存量数据（Showroom 15 行 / Survey Results 12 行无表头 / survey_points 13 SP + 2 retired / fengshui 7）迁入 PG，幂等可重放，对账零差异

## 外审十条硬性验收（Codex 2026-09-15）

1. 先建 source-manifest.json：四源文件绝对路径（含「项目」目录层级：E:\项目\uganda-house-finder\...）、SHA256、行数、字段头、抓取时间；先重新拉取 Survey Results 当前快照
2. migration-map.json 人工可审：SP 点多为扫街簇≠现实店面，禁止全部直写 site；Showroom/FL-SP/风水 slug 关联列 unmatched/ambiguous，禁止按名字静默猜
3. --dry-run 先行：只解析+生成映射报告不写库；UUID/幂等键确定性生成；重复源行单独报告
4. 正式导入单事务：BEGIN → SET LOCAL app.migration/app.actor_uuid → upsert → COMMIT；原生数据库连接（SUPABASE_DB_URL），禁止多次 PostgREST 模拟会话
5. site 触发器已产首条 migration log，不得手工再插；正式跑两遍第二遍零新增
6. 负向对账只改临时副本，不改源文件
7. 关单六组机器证据：dry-run 映射/首次导入/二次零新增/负向差异定位/回滚重跑/rows_match:true
8. TASK-010 双写对账口径联动（source=form 且 added_date≥S4 起始日）
输入：docs/Design/02-Database.md §八 D4（svc_migration/回滚删除顺序）；§三 3.4/3.5/3.7/3.9；docs/Design/03-API.md §三（口径参考）；主线仓 survey_writeback.gs（列语义）；docs/Design/04-Module.md M-Mig
验收条件：
1. `migrate_data.mjs --dry-run` 出映射报告不写库；正式跑幂等（连跑两遍第二遍零新增）
2. 导入范围：site（含 archived 退役点）+survey_result(source='migration')+fengshui_eval+历史 log 回填；归属署名全为 svc_migration
3. `reconcile.mjs` 输出 `rows_match:true` 报告存档（行数一致 ∧ 每行关键字段拼接 sha1 一致，双表各自算）
4. 人为改一行源→rows_match:false 且差异行被点名（负向用例）
5. 回滚路径演练一次：按删除顺序 photo→survey_result→fengshui_eval→site_status_log(actor=svc_migration)→site 清空迁移数据，再整体重跑
审查结论：（完工时填）
