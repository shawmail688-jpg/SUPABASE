# 变更请求（Change Request）

Last Update：2026-09-14

---

## 变更 CR-001：Supabase 应用凭证切换为新式 key

- **日期**：2026-09-14
- **来源 Feature**：`docs/features/v1-launch/`
- **影响闸门**：架构四件 v1.2（L2 Lock）与 TASK-002/006/013/016

### 变更内容

**改什么**：客户端配置由旧 `anon key` 命名切换为 `publishable key`（`sb_publishable_...`），受控本机/服务端配置由旧 `service_role/service key` 命名切换为 `secret key`（`sb_secret_...`）；环境变量同步采用 `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`。

**为什么**：Supabase 官方文档已声明旧 `anon` / `service_role` API keys 将于 2026 年底前弃用；当前日期为 2026-09-14，若继续按旧 key 实施会形成临上线迁移债。（环境变化）

权威依据：

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/local-development/cli-workflows

### 影响评估

| 影响面 | 详情 |
|--------|------|
| 文档 | `CLAUDE.md`、Proposal §7、PRD 安全说明、Design 01/02/03/04、TASK-002/006/013/016；只改应用凭证名与注入约定，不改角色权限模型 |
| 代码 | 后续 `.env.example`、Pages `config.js` 与迁移/备份脚本的环境变量名；现有迁移 SQL 无需修改 |
| 测试 | TASK-002 day-1 五项、前端产物 secret-key 泄漏扫描、D3 RLS 用例 |
| 闸门状态 | 架构闸门需针对凭证条款重新 Review → Approve → Lock；其他已批准结构不解锁 |
| 复杂度 | 不重新评估：无新服务/依赖/数据模型/权限语义，仅供应商凭证制度时效修正 |

说明：PostgreSQL/PostgREST 的数据库角色 `anon` 与 `authenticated` 继续存在；新 publishable key 在未登录/已登录请求中仍分别映射到这些角色。因此 `0002_d2_rls_functions_rpcs.sql` 与 `sql_cases.sql` 中的角色名不是旧 API key，不应替换。

### 决策

**决策**：✅ approved（用户 2026-09-14 批准，ApprovalRecord #6）
**批准人**：用户
**理由**：官方弃用时间表明确（2026 年底前），现在切换避免临上线迁移债；权限模型与已入库迁移 SQL 零改动。

### 执行记录

- [x] 状态镜像文档已同步（CLAUDE.md/Proposal §7/Design 01-04/ADR-007/TASK-002/013/016 共 31 处替换，grep 零残留；Requirement.md 为锁定历史记录不改；数据库角色 `anon`/`authenticated` 不涉及）
- [x] 代码已修改（`.env.example` 以 SUPABASE_PUBLISHABLE_KEY/SUPABASE_SECRET_KEY 建档；业务代码尚未产生）
- [ ] 测试已重跑（day-1 五项执行后附证据）
- [x] 原闸门重新 Review → Approve → Lock（架构四件凭证条款，ApprovalRecord #6）
- [x] 原 ApprovalRecord 已追加变更条目

---

## 变更 CR-002：三项目地图瓦片韧性

- **日期**：2026-09-14
- **来源**：用户反馈地图瓦片 403，并要求 Atlas、选址系统及未来 Platform 长期稳定使用
- **影响闸门**：架构四件中的 01/04、TASK-011/012/013

### 变更内容与影响

**改什么**：禁止未来看板复制 `tile.openstreetmap.org`，新增统一 `window.MAP_TILE_CONFIG` 契约；默认街道/卫星主备与连续 3 次失败自动降级；Pages 发布加故障注入。

**为什么**：OSM 公共标准瓦片要求有效 Referer、无 SLA 且可无通知封锁；本地 HTML/预览链已实际出现 403。

| 影响面 | 详情 |
|--------|------|
| 文档 | Design 01/04、ADR-008、TASK-011/012/013 |
| 代码 | Platform 尚未进入 TASK-011，无现有运行代码需迁移 |
| 测试 | 静态扫描、street 故障注入、file/localhost/Pages 三环境实测 |
| 数据/API | 无变化 |
| 回滚 | 删除新增配置/降级条款即可恢复 v1.2；不影响数据库主线 |

### 决策与执行记录

- 立项与实施授权：approved（用户 2026-09-14 指令）
- L2 架构重新 Lock：approved（用户 2026-09-14，ApprovalRecord #7）
- [x] 状态镜像文档已同步为 In Review
- [x] ADR-008 已建立
- [x] TASK-011/012/013 验收已同步
- [x] Review → Approve → Lock

---

## 变更 CR-003：R17 跨项目 RLS 隔离——项目成员模型（待用户决策）

- **日期**：2026-09-15
- **来源**：Codex 外审 CHANGES REQUIRED 第 2 项——site_select 无项目成员条件，T15 仅以手动 project_id 过滤冒充隔离，R17「跨项目隔离」实际未实现
- **影响闸门**：架构四件 01/02/03、TASK-005/011/012

### 方案二选一（用户决策）

- **A 项目成员模型**：新增 project_member(project_id, user_id) 表；site_select 等 RLS 加成员条件；admin 全通。成本：一表+策略改造+D3 扩充（约 1 天）；换来多项目真隔离（换电站复用时必需）
- **B 正式延期**：v1 明确单项目（乌干达 Showroom），R17 改为「单项目语义」，跨项目随换电站立项再设计。成本：零；风险=复用时 RLS 大改

### 决策与执行记录

- 决策：✅ **B 正式延期**（用户 2026-09-15：调查员同时负责 showroom 与换电站选址，共用不隔离；R17 改「单项目语义」，跨项目隔离随换电站立项时再设计）
- 措辞收回：PROJECT_CONTEXT/TODO 中 R17「已覆盖」表述已于 09-15 收回

---

## 维护规则

- 追加写入同一文件（按 Feature 分组）。
- 每条变更对应一条 ApprovalRecord 变更条目（二处同步更新）。
