# PROJECT_CONTEXT.md

> Claude Code 工作上下文（Working Context）· 控制在 1~2 页（C1）

# 1. Current Status（当前开发状态）

- Current Feature：v1-launch（阶段一+阶段二首次上线，M1→M3b）
- Current Stage：M1 数据底座已完成，进入 **M2b 表单换靶执行阶段**；TASK-001~006 DONE，TASK-007/008/009 尚未完成。
- Progress：
  - 🟢 M0 立项（13f692d）
  - 🟢 ②Requirement v1.2 / ③Scope v1.0（L1 已批）/ ④PRD-V1 v1.1（L2 已批 Lock，评审 15 条全处置）/ ⑤ADR-001~007 归档
  - 🟢 ⑥架构四件 v1.2（L2 已批 Lock 09-04：两轮评审闭环 FAIL→v1.1→PASS-with-comments→R1-R8 全修复→v1.2；ApprovalRecord #4）
  - 🟢 ⑦任务规划 TASK-001~018（L1 已批；TASK-001 DONE 1e1a623：Frankfurt 拍板 + D1/D2 迁移 SQL 预编写入库）
  - 🟢 TASK-002 前置：域名、Supabase 账号、部门 Organization 与远端 Project 均已完成；Project URL/Ref 已由用户提供并经 DNS/HTTP 只读核验
  - 🟢 CR-001 凭证切新式 key（#6，31 处文档同步 + .env.example）+ CR-002 地图瓦片韧性 ADR-008（#7）均 09-14 批准 Lock
  - 🟢 TASK-002 day-1 五项验证全 PASS（RLS anon 零/401、签名 URL 过期 400、浏览器直传 200、Realtime INSERT 3.9s、file:// CORS 200；踩坑 4 条留档 day1/ 日志）
  - 🟢 Raymond intake：Silent Night 已按 Sheet 最新资料、Google Maps 坐标和照片入库；Aga Khan Hospital Space 已以第 8 家候选入库并挂照片，因未发现其自己的地图 pin，坐标明确待补
  - 🟢 CR-004：Survey 金额口径为 USD，历史数值不换算；历史编辑重发采用 append-only `raw.supersedes`；domain_config v3/v4 已部署
  - 🟢 TASK-007：24 张真实照片完成压缩定档；默认 1800px/q0.80/1MB，细节 2400px/q0.90/2.5MB
  - 🟡 TASK-008 IN REVIEW：照片压缩/IndexedDB、Storage 直传、原子 resolver RPC、target 队列、401 恢复、archived 防御与 dual 状态已实现；本地 selftest 44/44、selftest2 33/33
  - 🟡 TASK-009 IN REVIEW：本地浏览器 44/44、33/33，375px 无溢出；真实账号 E2E 脚本已安全化，需轮换旧测试密码后再跑
  - 🟡 TASK-011 IN REVIEW：`web/dashboard/` 骨架、Auth 登录墙、角色分流、latestSurvey、公开配置注入与非 OSM 瓦片契约已实现；Dashboard selftest 7/7
  - 🟡 TASK-012/014 IN REVIEW：leader 计数/地图/历史详情/RPC 操作与 work 编辑/CSV 已接上同一 API 契约；Realtime、签名过期重签和 archived admin 窗口留真实 E2E
  - 🟡 TASK-015 IN REVIEW：看板角色与操作矩阵本地 full selftest 7/7；375px/真实 Supabase RPC 与 Realtime 留账号窗口
  - 🟡 TASK-013 IN REVIEW：Cloudflare Pages 已上线自定义域名 `ugandastartimes.com`；统一入口包（`3543611`）将 surveyor 自动分流到 `/survey.html`、manager/admin 留看板并交接同一 Auth 会话；线上 HTTPS 三路径 200，Dashboard 7/7、Survey 44/44+33/33；真实账户手机操作/瓦片实开待用户验收
  - 🟢 CR-005 DONE：archived 改为可见历史归档，新增 hidden 作为拒绝/隐藏唯一状态；远端 0007/0008 已执行并核验 enum/RPC
  - 🟡 待用户确认：2FA 与备份管理员状态；backup admin 兼 dept@ 转发第二收件人

# 2. Working Set（当前工作区）

- 文档：docs/SurveyPlatform-Proposal-v1.3.md（权威方案）、docs/Assessment.md（Large 定级）、docs/SurveyPlatform-Quote-v1.md/.html/.pdf（费用明细 QSP-2026-001 r5）、docs/features/v1-launch/ChangeRequest.md（CR-001/002 已批准 Lock）
- 计划产出：docs/features/v1-launch/、docs/PRD/、docs/Design/、docs/ADR/、tasks/TASK-*
- 代码：`webapp/survey_form.html`、`webapp/build_webapp.py`、`scripts/e2e_form.mjs`；迁移 `0001`~`0005`；Raymond intake SQL 位于 `scripts/sql/`

# 3. Next Step（下一步）

- 完成顺序：TASK-007 已完成，TASK-008/011/012/013/014/015 进入 Review；下一步轮换测试账号密码并执行 TASK-009 真实 E2E，同时完成 TASK-013 自定义域名/手机实开验收，再启动 TASK-010 双写对账。
- 待决决策项（用户动作，阻塞点）：
  - [x] 域名已配置（2026-09-14 用户同步；具体域名不写入快照）
  - [x] Supabase 账号已注册（2026-09-14 用户同步）
  - [x] Supabase 部门 Organization 已创建（2026-09-14 控制台实证，Free）
  - [x] Supabase `survey-platform` Project 已创建（Ref=`jfggeudssomocwcnpawk`；2026-09-14 DNS/HTTP 只读核验通过）
  - [ ] 2FA 与备份管理员状态确认（30 秒核对：Account→Security 开 2FA；组织 Members 邀第二管理员）
  - [x] CR-001 已批准（09-14，#6）；CR-002 已批准 Lock（09-14，#7）
  - [x] `.env` 用户已填（publishable/secret key + Access Token；密钥不进对话、不进 git）
  - [x] domain_config v3/v4 已按 CR-004 追加部署（历史金额本就是 USD，不换算）
  - [ ] 轮换曾进入本地 Git 历史的 E2E 测试账号密码，再运行真实账号回归
  - [ ] **次月起 Pro 订阅付款 $25/月**（首月免费验证后）
  - [x] 费用明细 QSP-2026-001 已上报领导（2026-09-14 用户确认）；IT 监控盘点四问（提案阶段遗留，不阻塞本仓）
- 当前实现任务：**TASK-007/008/009**；先完成照片压缩/直传与离线可靠性，再用已安全化的 E2E 脚本完成真实账号验收。密钥不进对话、不进 git。

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
