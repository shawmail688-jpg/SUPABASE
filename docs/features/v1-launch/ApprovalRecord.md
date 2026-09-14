# 审批记录（ApprovalRecord）

Last Update：2026-09-14

> 追加型登记册：每次批准/拒绝一条记录。语义见 SE Skill `rules/approval.md`（默认未批准；一句话+留痕）。

| # | 日期 | 变更单元 | 级别 | 证据 | 结论 |
|---|------|----------|------|------|------|
| 1 | 2026-09-03 | Requirement v1.0 + Scope v1.0（R1-R18/N1-N4 + 阶段一/二划界） | L1 | 校验器 sections 全过（Requirement 1/1、Scope 3/3）；placeholders 0 | ✅ 用户确认，附两裁定：①存量照片迁入 Storage（R12 定稿）；②「前端更好看」入 N5 |
| 2 | 2026-09-03 | Requirement v1.0→v1.1（R12 定稿 + N5 UI 视觉质量入册） | L1 | 同上复审后用户确认「定稿」 | ✅ 需求/范围 Lock，进入 PRD |
| 3 | 2026-09-03 | PRD-V1 v1.0→v1.1（独立评审 15 条全处置：区域并入户前拍板/恢复权限落定/Realtime 基线回归/atlas_bridge 验收后退役/表单分发渠道补全等） | **L2** | ReviewRecord.md：独立子代理 PASS-with-comments + PRD §十二 处置表；校验器通过 | ✅ 用户批准 Lock；R4/重复行勘误随之入 Requirement v1.2；进入架构四件 |
| 4 | 2026-09-04 | 架构四件 v1.0→v1.2（01-Architecture/02-Database/03-API/04-Module）+ ADR-007 新建。两轮闭环：首轮独立评审 FAIL（4H/9M/7L 共 20 条全采纳→v1.1）；复审 PASS-with-comments（19/20 通过+R1 中/R2-R8 低→全修复→v1.2） | **L2** | ReviewRecord.md 记录 2（两轮完整）；ADR-007；校验器 placeholders 0 | ✅ 用户批准 Lock（四文档 Status→Approved）；进入 ⑦ 任务规划 |
| 5 | 2026-09-04 | 任务规划 TASK-001~018（tasks/ 单 18 份+README 看板/依赖链+docs/TODO.md 镜像；里程碑=阶段一 001~010/阶段二 011~015/运维退役 016~018；用户阻塞点=账号注册/区域拍板/Pro 付款，域名仅 013 前） | L1 | 依赖链闭环检查；验收条件全部可自动化（C6）；PROJECT_CONTEXT/TODO 双镜像同步 | ✅ 用户确认通过；规划阶段收官，进 M1 执行（TASK-001，阻塞=用户注册账号） |
| 6 | 2026-09-14 | CR-001 Supabase 应用凭证切换新式 key（anon key→publishable key / service key→secret key；env=SUPABASE_PUBLISHABLE_KEY/SUPABASE_SECRET_KEY）。文档同步 31 处替换（CLAUDE/Proposal §7/Design 01-04/ADR-007/TASK-002/013/016）+ .env.example 建档；数据库角色 anon/authenticated 与已入库迁移 SQL 不变 | **L2** | ChangeRequest.md CR-001 影响评估表；grep 零残留验证；权威依据=supabase.com/docs 官方 API keys 页 | ✅ 用户批准；架构四件凭证条款重新 Lock；测试重跑项挂 day-1 完成后补 |
| 7 | 2026-09-14 | CR-002 三项目地图瓦片韧性（ADR-008 + `window.MAP_TILE_CONFIG` 契约：街道/卫星主备、连续 3 次失败自动降级、禁依赖 OSM 公共瓦片、Pages 发布加故障注入；Design 01/04+TASK-011/012/013 验收已同步） | **L2** | ChangeRequest.md CR-002 影响评估与回滚条款；ADR-008；OSM 403 实证 | ✅ 用户批准 Lock；TASK-011 开工时按新验收执行 |
