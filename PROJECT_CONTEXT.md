# PROJECT_CONTEXT.md

> Claude Code 工作上下文（Working Context）· 控制在 1~2 页（C1）

# 1. Current Status（当前开发状态）

- Current Feature：v1-launch（阶段一+阶段二首次上线，M1→M3b）
- Current Stage：规划链全部收官（Requirement→Scope→PRD→ADR→架构→任务规划，ApprovalRecord #1-#5）→ **M1 执行阶段**；TASK-001 阻塞=用户注册 Supabase 账号
- Progress：
  - 🟢 M0 立项（13f692d）
  - 🟢 ②Requirement v1.2 / ③Scope v1.0（L1 已批）/ ④PRD-V1 v1.1（L2 已批 Lock，评审 15 条全处置）/ ⑤ADR-001~007 归档
  - 🟢 ⑥架构四件 v1.2（L2 已批 Lock 09-04：两轮评审闭环 FAIL→v1.1→PASS-with-comments→R1-R8 全修复→v1.2；ApprovalRecord #4）
  - 🟡 ⑦任务规划：tasks/TASK-001~018 + 看板/依赖链 + docs/TODO.md 镜像（L1 待批）

# 2. Working Set（当前工作区）

- 文档：docs/SurveyPlatform-Proposal-v1.3.md（权威方案）、docs/Assessment.md（Large 定级）
- 计划产出：docs/features/v1-launch/、docs/PRD/、docs/Design/、docs/ADR/、tasks/TASK-*
- 代码：尚无（M1 起建 `supabase/migrations/` + `scripts/`）

# 3. Next Step（下一步）

- 完成顺序：规划链已走完 Requirement→Scope→PRD→ADR→架构→任务规划；当前=⑦ L1 批准 → M1 编码（TASK-001 起，编码走分支→PR→审后合）
- 待决决策项（用户动作，阻塞点）：
  - [ ] **Supabase 账号注册**（TASK-001 前置）→ TASK-001 交付两区域 RTT 证据 → **区域拍板**（建项目固定参数，开户前必须定）
  - [ ] **Pro 订阅付款 $25/月**（TASK-002）
  - [ ] 域名有无（公司现成 or 买 ≈¥70/年）——仅 TASK-013 上线前需要，不阻塞建库
- 首个实现任务：TASK-001（区域 RTT 实测）；我方可先行零阻塞任务：无（TASK-003 前置 002）

# 4. Important Decisions（重要设计决策）

- ADR-001 Supabase Pro 承重底座（否决免费档/自建HK/Firebase/D1/维持Sheet；合规备选=平迁自建HK）
- ADR-002 四态状态机+审批流+全库软删除（否决九态/物理删除；operating 预留）
- ADR-003 权限两类角色+admin（否决 Role+Scope 组织树/匿名可读）
- ADR-004 照片本地压缩直传私有桶（否决原图直传/本地冷备依赖/公开桶）
- ADR-005 Sheets 降级存档、管理全走网页（否决双向同步；备轨 §9 约 2 天可捡）
- ADR-006 监控=厂商开放平台后续项目、总部 API=归档轨道（否决自建中继/现在谈总部）

---

# References（引用文档，本文件不维护）

| 内容 | 文档 |
|------|------|
| 权威方案（已批准） | docs/SurveyPlatform-Proposal-v1.3.md |
| 复杂度评估 | docs/Assessment.md（Large，硬触发 2） |
| 产品需求 | docs/PRD/PRD-V1.md |
| 系统架构 | docs/Design/01-Architecture.md |
| 数据模型（DDL） | docs/Design/02-Database.md |
| API 接口 | docs/Design/03-API.md |
| 模块划分 | docs/Design/04-Module.md |
| 决策记录 | docs/ADR/ADR-*.md |
| 需求/范围/任务/测试/发布（过程产物） | docs/features/v1-launch/ |
| 任务单 | tasks/TASK-xxx-*.md（格式见 tasks/README.md，项目约定优先） |
| 当前勾选清单 | docs/TODO.md |
| 技术债登记 | TECH_DEBT.md |
| 工作流程 | CLAUDE.md（本仓库）+ SE Skill Large（workflows/large.md） |

# Maintenance Rules（维护规则）

- 仅更新 Current Status / Working Set / Next Step / Important Decisions 四节；状态镜像测试通过即同步（C3）
