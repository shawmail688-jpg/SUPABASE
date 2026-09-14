# PROJECT_CONTEXT.md

> Claude Code 工作上下文（Working Context）· 控制在 1~2 页（C1）

# 1. Current Status（当前开发状态）

- Current Feature：v1-launch（阶段一+阶段二首次上线，M1→M3b）
- Current Stage：规划链全部收官（ApprovalRecord #1-#7）→ **M1 执行阶段**；TASK-001 DONE（Frankfurt）；**TASK-002 DONE（09-14 day-1 五项全 PASS，证据 day1/）**；**TASK-003 DONE（09-14 四项验收全 PASS，证据 evidence-task003/）**；**TASK-004 DONE（09-14 两遍 28/28，证据 evidence-task004/；domain_config v2 已回填，用户复核待补）**；当前=**TASK-005 存量导入 D4+对账**
- Progress：
  - 🟢 M0 立项（13f692d）
  - 🟢 ②Requirement v1.2 / ③Scope v1.0（L1 已批）/ ④PRD-V1 v1.1（L2 已批 Lock，评审 15 条全处置）/ ⑤ADR-001~007 归档
  - 🟢 ⑥架构四件 v1.2（L2 已批 Lock 09-04：两轮评审闭环 FAIL→v1.1→PASS-with-comments→R1-R8 全修复→v1.2；ApprovalRecord #4）
  - 🟢 ⑦任务规划 TASK-001~018（L1 已批；TASK-001 DONE 1e1a623：Frankfurt 拍板 + D1/D2 迁移 SQL 预编写入库）
  - 🟢 TASK-002 前置：域名、Supabase 账号、部门 Organization 与远端 Project 均已完成；Project URL/Ref 已由用户提供并经 DNS/HTTP 只读核验
  - 🟢 CR-001 凭证切新式 key（#6，31 处文档同步 + .env.example）+ CR-002 地图瓦片韧性 ADR-008（#7）均 09-14 批准 Lock
  - 🟢 TASK-002 day-1 五项验证全 PASS（RLS anon 零/401、签名 URL 过期 400、浏览器直传 200、Realtime INSERT 3.9s、file:// CORS 200；踩坑 4 条留档 day1/ 日志）
  - 🟡 待用户确认：2FA 与备份管理员状态（邮箱仍缺，M2b 前需要）；backup admin 兼 dept@ 转发第二收件人
  - 🟡 TASK-002 凭证接入：`.env.example` 已建（新式命名）；待用户从 Dashboard 填入真实 key 至本地 `.env`；day-1 五项尚未执行

# 2. Working Set（当前工作区）

- 文档：docs/SurveyPlatform-Proposal-v1.3.md（权威方案）、docs/Assessment.md（Large 定级）、docs/SurveyPlatform-Quote-v1.md/.html/.pdf（费用明细 QSP-2026-001 r5）、docs/features/v1-launch/ChangeRequest.md（CR-001/002 已批准 Lock）
- 计划产出：docs/features/v1-launch/、docs/PRD/、docs/Design/、docs/ADR/、tasks/TASK-*
- 代码：`supabase/migrations/0001_d1_schema.sql` + `0002_d2_rls_functions_rpcs.sql`、`scripts/sql_cases.sql`、`scripts/sql/rollback_d1_d2.sql`（均已入库；RLS 中的数据库角色名不受 CR-001 影响）

# 3. Next Step（下一步）

- 完成顺序：规划链已走完 Requirement→Scope→PRD→ADR→架构→任务规划；TASK-001/002/003/004 DONE；**TASK-005 挂起等 Codex 外审 D1-D3**（评审包 docs/features/v1-launch/review/，结论回来过证据核验后放行）
- 待决决策项（用户动作，阻塞点）：
  - [x] 域名已配置（2026-09-14 用户同步；具体域名不写入快照）
  - [x] Supabase 账号已注册（2026-09-14 用户同步）
  - [x] Supabase 部门 Organization 已创建（2026-09-14 控制台实证，Free）
  - [x] Supabase `survey-platform` Project 已创建（Ref=`jfggeudssomocwcnpawk`；2026-09-14 DNS/HTTP 只读核验通过）
  - [ ] 2FA 与备份管理员状态确认（30 秒核对：Account→Security 开 2FA；组织 Members 邀第二管理员）
  - [x] CR-001 已批准（09-14，#6）；CR-002 已批准 Lock（09-14，#7）
  - [x] `.env` 用户已填（publishable/secret key + Access Token；密钥不进对话、不进 git）
  - [ ] domain_config v2 用户复核（追加制；如有出入以 v3 修订，不阻塞 TASK-005）
  - [ ] **次月起 Pro 订阅付款 $25/月**（首月免费验证后）
  - [x] 费用明细 QSP-2026-001 已上报领导（2026-09-14 用户确认）；IT 监控盘点四问（提案阶段遗留，不阻塞本仓）
- 首个实现任务：**TASK-005 存量导入**（D4：Sheet 双表+JSON→PG，migrate_data.mjs 需按 04-Module 设计新建并走分支→PR）；密钥不进对话、不进 git

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
