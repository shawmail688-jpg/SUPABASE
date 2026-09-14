# Codex 外审结论处置表（D1/D2/D3，CHANGES REQUIRED）

> 外审日期：2026-09-14 · 处置：2026-09-15 · 外审结论：CHANGES REQUIRED（TASK-005 挂起）
> 用户终裁：按 Codex 十条指令执行。本表 = 逐条核验与处置状态。

## 一、五项评审意见处置

| # | 外审意见 | 核验 | 处置 | 状态 |
|---|----------|------|------|------|
| 1 | FK deferrable 采纳 | 方案成立，事务末检查、父行失败整体回滚 | 保留 0001 现状 | ✅ 闭环 |
| 2 | record() security definer 有条件采纳 | 须钉 search_path；guc(k,v) 不改 definer | 保留；安全面记录在案（仅会话私有 temp 表） | ✅ 闭环 |
| 3 | 幂等改造仅采纳「上线前干净库重放」；**不得再改已落库的 0001/0002**，修复一律新增 0003；IF NOT EXISTS 不检测结构漂移 | 成立 | 纪律入册：0001/0002 冻结；0003_pre_d4_hardening.sql 已建（见下） | ✅ 闭环 |
| 4 | rent/space 可空采纳，配置/API 层做「数值或拒答原因二选一」 | 成立（refused 旗标已在 v2 config） | domain_config v2 schema_note 已含；API 层约束在 TASK-008 表单换靶时落地 | ✅ 闭环 |
| 5 | **domain_config v2 驳回——账实不一致** | 实证成立：库内仅 v1 占位。根因 = v2 入库（201）后又执行了回滚演练+重放，v2 被清除，未再核账 | **已修复**：0003 持久化 v2 + T27 回归断言（v2 存在且非占位）入 D3；教训入册：破坏性操作后必须重核账 | ✅ 闭环 |

## 二、四项必修处置

| # | 事项 | 处置 | 状态 |
|---|------|------|------|
| 1 | site/fengshui_eval INSERT 可伪造 created_by/挂他人站点 | 0003：site_insert→`with check (created_by = auth.uid())`；fe_insert→`created_by = auth.uid()` 且站点须自有或 manager；负向用例 T23/T24 入 D3（拒），正向 T25 | ✅ 闭环 |
| 2 | R17 跨项目隔离未实现（T15 仅手动过滤） | **CR-003 登记**：项目成员模型 vs 正式延期多项目隔离——用户决策；决策前 PROJECT_CONTEXT/TODO 措辞已收回「已覆盖」 | 🟡 待用户 C2 决策 |
| 3 | canonical sql_cases 回滚后读 temp 表 + 22/22 与 28/28 分叉 | 修复：count 移至 rollback 前、删除 rollback 后 select、判分口径动态化；适配版由 canonical 机械再生成 | ✅ 闭环 |
| 4 | TASK-005 输入未锁定 + TASK-006 路径不存在 | TASK-005 任务单重构（十条指令并入）；TASK-006 路径改为 `E:\项目\uganda-house-finder\data\survey\photos`（已实证存在）；source-manifest.json 列为 TASK-005 首步 | 🟡 已重构，执行待启 |

## 三、十条指令 → 任务映射（Codex 指令原文已存 review/ 请求书回执）

| 指令 | 落点 | 状态 |
|------|------|------|
| 1. 0003_pre_d4_hardening.sql（v2 持久化/INSERT 收紧/audit actor/restore 行锁） | `supabase/migrations/0003_pre_d4_hardening.sql`，已应用 201 | ✅ |
| 2. 扩充 D3 + 修 canonical + 两遍远端全绿留证 | T23-T27 入 canonical；两遍 33/33（d3_run1/run2.log） | ✅ |
| 3. R17 提 C2 | CR-003（ChangeRequest.md），待用户选择「成员模型」或「正式延期」 | 🟡 待决策 |
| 4. source-manifest.json + 修正路径 | TASK-005 首步 + TASK-006 路径已修 | 🟡 TASK-005 执行时 |
| 5. migration-map.json（禁止静默猜名） | TASK-005 任务单硬性验收 | 🟡 |
| 6. migrate_data.mjs --dry-run 先行 | TASK-005 任务单硬性验收 | 🟡 |
| 7. 正式导入单事务（BEGIN→SET LOCAL→upsert→COMMIT，原生连接） | TASK-005 任务单硬性验收 | 🟡 |
| 8. 依赖审批（postgres/csv-parse 最小集） | **待用户批准**后才建 package.json | 🟡 待用户 |
| 9. 首条 migration log 勿重；两遍零新增；负向对账只改临时副本 | TASK-005 任务单硬性验收 | 🟡 |
| 10. 六组机器证据 + 状态文档更新 | TASK-005 关单条件 | 🟡 |
