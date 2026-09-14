# 数据库设计（Database）

Version：1.2（1.1→1.2：复审 R2/R4/R5/R7 处置；1.0→1.1：首轮评审 20 条处置，见 ReviewRecord）
Status：Approved（L2 闸门 2026-09-04 用户批准，Lock；变更走 C2）
Author：Claude
Last Update：2026-09-03

---

# 一、技术选型

| 项 | 选型 | 说明 |
|----|------|------|
| 数据库 | Supabase Pro（Postgres 15+ / PostGIS） | ADR-001 |
| 迁移工具 | `supabase/migrations/NNN_*.sql` 纯 SQL 文件，按序号重放（`supabase db push` 或 psql） | 无 ORM、无迁移框架；重放=回滚验证 |
| 访问驱动 | supabase-js（PostgREST 自动 API） | 前端/脚本同栈；secret key 仅本机脚本 .env |
| 主键策略 | 业务表 uuid `gen_random_uuid()` 且**归属列默认 `auth.uid()`**（客户端可预生成覆盖→离线幂等）；audit_log bigint identity | 评审 M3 |
| 时间戳 | 投影表（project/app_user/site/survey_result）带 `created_at`+`updated_at`（触发器维护）；append-only 表（photo/fengshui_eval/site_status_log/audit_log/**domain_config**——版本递增、旧行不改，复审 R5）仅 `created_at`/`at` | 评审 L1：updated_at 非全表 |
| 删除权限 | 迁移 SQL 显式 `REVOKE DELETE ON ALL TABLES FROM anon, authenticated`（Supabase 默认有 GRANT，必须显式回收）+ 无任何 DELETE 策略 | 评审 L2：软删除纪律落到授权层 |

# 二、变更概览

| 类型 | 对象 | 说明 |
|------|------|------|
| 新增枚举 | `site_status` / `app_role` | site_status 含 operating 预留 |
| 新增表 | 10 张 | project, domain_config, app_user, site, survey_result, photo, site_status_log, external_ids, fengshui_eval, audit_log |
| 新增函数 | `is_manager()` / `is_admin()` / `set_updated_at()` / `audit_fn()` / `site_before_change()` / `approve_site()` / `hide_site()` / `restore_site()` | 角色判定+审计+状态机收口（GUC 闸见 §6.1） |
| 授权回收 | REVOKE DELETE（全表，anon+authenticated） | 软删除纪律 |
| 种子数据 | project 1 行 + domain_config v1 + app_user 种子（走 migration SQL，superuser 身份） | 评审 L3① |
| 新增桶 | Storage `photos`（private） | 策略见 §七 |
| **device 表** | **不建** | 随 M5（ADR-006） |

# 三、表设计

## 3.1 project（复现轴）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | | gen_random_uuid() |
| code | text | 项目标识（`uganda-showroom` / 未来 `battery-swap`） | unique not null |
| name | text | 显示名 | not null |
| is_active | boolean | | default true |
| created_at / updated_at | timestamptz | | |

## 3.2 domain_config（配置驱动）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | | |
| project_id | uuid FK→project | | not null on delete restrict |
| version | int | 配置版本，递增 | unique(project_id, version) |
| config | jsonb | 调查字段结构全量（表单+看板读取） | not null |
| created_by | uuid FK→app_user | **default auth.uid()** | |
| created_at | timestamptz | | |

## 3.3 app_user（账号挂钩，id=auth.users.id）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | **= auth.users.id**（一人一号） | |
| display_name | text | | not null |
| role | app_role | `manager` / `surveyor` / `admin`（admin ⊃ manager 权限+恢复权） | not null default 'surveyor' |
| is_active | boolean | 停用=置 false（不删号） | not null default true |
| created_at / updated_at | timestamptz | | |

**建号两步（admin 操作，superuser 路径非客户端 API）**：①Studio Auth 页建 auth.users 行；②SQL 插对应 app_user 行定 role。

> **例外（复审 R7）**：`svc_migration` 机器账号——**无 auth.users 行**（secret key 专用，任何人不可用它登录前端），app_user 行随 D2 种子建。

## 3.4 site（一个 site=一个现实店面/候选对象）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | | |
| project_id | uuid FK→project | | not null |
| code | text | 业务编号（迁移自 SP 点位 ID） | **unique(project_id, code)** |
| name | text | 店面名称 | not null |
| grp | text | 区域/分类（汇总条区域筛选项） | |
| address | text | 地址 | |
| lat / lon | double precision | 坐标 | |
| geog | geography(point,4326) | 生成列（lat/lon 非空时）；**day-1 验证项**：部分 PostGIS 版本 `::geography` cast 非 IMMUTABLE 会拒建——失败则降级为触发器维护列（评审 L5） | GIST 索引（V1 看板 bbox 过滤即可） |
| status | site_status | `surveying`/`candidate`/`selected`/`archived`/`operating`(预留) | not null default 'surveying'；**任何客户端直改被触发器 GUC 闸拒绝（§6.1）** |
| created_by | uuid FK→app_user | 首个提交者 | not null **default auth.uid()**（评审 M3） |
| created_at / updated_at | timestamptz | 行级裁决依据 | |

## 3.5 survey_result（调查历史，append-only）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | **客户端预生成**（离线幂等） | |
| site_id | uuid FK→site | | not null on delete restrict |
| rent | numeric | 租金 | |
| space | numeric | 面积 | |
| contact | text | 联系人 | |
| surveyor_name | text | 调查员姓名（原管线语义） | |
| added_date | date | 调查日期 | |
| raw | jsonb | 表单全量字段 | not null default '{}' |
| source | text | `form` / `migration` / `appscript` | not null default 'form' |
| created_by | uuid FK→app_user | | not null **default auth.uid()** |
| created_at | timestamptz | | |
| | | **索引** | (site_id, created_at desc) |

## 3.6 photo（只存元数据）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | 客户端预生成 | |
| site_id | uuid FK→site | | not null |
| survey_result_id | uuid FK→survey_result | 哪次调查拍的（可空=挂点） | on delete set null |
| storage_path | text | 桶内路径 `{project_code}/{site_code}/{sha1}.jpg` | not null unique |
| sha1 | char(40) | 内容去重 | not null |
| kind | text | `normal` / `detail` | not null default 'normal' |
| taken_at | timestamptz | EXIF（可空） | |
| uploaded_by | uuid FK→app_user | | not null **default auth.uid()** |
| created_at | timestamptz | | |
| | | **索引** | unique(sha1)、(site_id) |

## 3.7 site_status_log（状态流水唯一权威）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | bigint identity PK | | |
| site_id | uuid FK→site | | not null |
| from_status | site_status | NULL=首次创建 | |
| to_status | site_status | | not null |
| action | text | `submit` / `approve_candidate` / `approve_selected` / `hide` / `restore` / `migration`（存量导入历史回填） | not null |
| actor | uuid FK→app_user | **default auth.uid()**；迁移=svc_migration 专用账号 | not null |
| at | timestamptz | | default now() |
| note | text | | |
| | | **索引** | (site_id, at) |

## 3.8 external_ids（落库数据过映射；V1 仅预置结构）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | | |
| entity_type | text | `store` / `survey_point` / `device` | check in 枚举 |
| entity_id | uuid | 本平台实体 | not null |
| external_system | text | `camera_cloud` / `hq_ops` / … | not null |
| external_id | text | 对端 ID | not null |
| added_by / added_at | | | |
| | | **约束** | unique(external_system, entity_type, external_id)；INSERT/UPDATE 均 manager（评审 L3②） |

## 3.9 fengshui_eval（风水测评迁移目标）

| 字段 | 类型 | 说明 | 约束 / 索引 |
|------|------|------|-------------|
| id | uuid PK | | |
| site_id | uuid FK→site | | not null |
| raw | jsonb | 原 fengshui_evals.json 全量 | not null |
| created_by / created_at | | 迁移=svc_migration | |

## 3.10 audit_log（触发器自动，客户端不可写）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint identity PK | |
| table_name / op | text | INSERT / UPDATE |
| row_id | uuid | |
| old_data / new_data | jsonb | UPDATE 含 old→new |
| actor | uuid | `auth.uid()`（可 null=service） |
| at | timestamptz | default now() |

挂触发器表：site / survey_result / photo / app_user / domain_config / project。**无客户端 UPDATE/DELETE**（append-only，admin 只读）。

# 四、关系

```text
project 1─┬─N domain_config
          └─N site 1─┬─N survey_result 1─N photo
                     ├─N photo
                     ├─N site_status_log
                     ├─N fengshui_eval
                     └─N external_ids(entity_id)
app_user（=auth.users）… created_by / actor / uploaded_by 全指向它
audit_log 独立（table_name+row_id 松耦合）
```

# 五、RLS 策略矩阵（权限的唯一执行点）

辅助函数（security definer，防递归）：`is_manager()` = role ∈ ('manager','admin') ∧ is_active；`is_admin()` = role='admin' ∧ is_active。**全部表启用 RLS；anon zero policy。**

| 表 | SELECT | INSERT | UPDATE | DELETE |
|----|--------|--------|--------|--------|
| project / domain_config | 全部 authenticated | —（种子走 SQL） | admin | — |
| app_user | authenticated | —（建号走 Studio+SQL，§3.3） | 本人(display_name) / admin(role, is_active) | — |
| site | **authenticated 全量，但默认排除 archived**（`status≠'archived'`）；manager/admin 含 archived（恢复视图） | authenticated（status 强制 surveying，触发器兜底） | manager：全量（**status 列除外**——直改被 GUC 闸拒，§6.1）；surveyor：**仅 created_by=self 行**的基础字段（评审 M1）；清空字段发空串（COALESCE 闸见 §6.1） | **REVOKE+无策略** |
| survey_result | manager：全量；surveyor：created_by=self | `with check (created_by = auth.uid())`；on_conflict(id) ignore-duplicates 幂等 | surveyor 仅自己且 source='form' | — |
| photo | 同 site 可见性（surveyor 随 H1 放宽后=非 archived site 全量） | `uploaded_by = auth.uid()` | — | — |
| site_status_log | manager：全量；surveyor：自己 site 的 | **仅触发器/RPC 内部**（security definer；触发器是唯一 RLS 豁免点，评审 M2） | — | — |
| fengshui_eval | manager：全量；surveyor：自己 site 的 | authenticated | — | — |
| external_ids | manager | manager | manager | — |
| audit_log | admin 只读 | —（触发器 security definer） | — | — |

> **读权限口径（评审 H1 处置）**：R4 的「仅自己的数据」约束**写**；**读**上调查员需要看到全部非 archived site（复查既有点是日常主工作流：`site≠survey`，历次调查挂同一点）。故 site/photo 的 SELECT 对 authenticated 放宽为非 archived 全量。survey_result 保持 own-only（他人联系人信息属管理层视野）。

# 六、触发器与 RPC（状态机唯一入口）

## 6.1 触发器

| 触发器 | 属性 | 行为 |
|--------|------|------|
| `set_updated_at()` | invoker | 投影表 UPDATE 维护 updated_at |
| `audit_fn()` | **SECURITY DEFINER**（search_path 钉死） | §3.10 六表 AFTER INSERT/UPDATE 写 audit_log |
| `site_before_change()` | **SECURITY DEFINER**（search_path 钉死） | ①INSERT：status≠'surveying' 拒——**除非**会话 GUC `app.migration='on'`（存量导入旁路，含 archived 退役点）；②UPDATE：**status 列变更仅当 `app.via_rpc='on'`（RPC 内 set_config）或 `app.migration='on'`**，否则拒——manager 也不行（评审 H3：状态机唯一入口落到强制层）；③UPDATE：文本列（grp/address）`NEW.col=COALESCE(NEW.col,OLD.col)`（评审 H2：null 不覆盖既有值，清空须发空串）；lat/lon 不设 COALESCE——**显式 null=清空坐标**（可改「未知」，复审 R2）；④INSERT 时自动写首条 site_status_log(action='submit'，at=now())——definer 身份绕过 log 表 RLS（评审 M2）；迁移路径改写 action='migration'/at=Added（§八 D4） |

> GUC 闸是状态机「唯一入口」声明的强制实现：任何绕过 RPC 的 status 直改（含 manager PATCH）在触发器层报错。PRD R2「非法转换一律拒绝」由此成立。

## 6.2 RPC（PostgREST `/rest/v1/rpc/...`，security definer，单事务；入口处 `set_config('app.via_rpc','on',true)`）

| RPC | 角色 | 事务体 |
|-----|------|--------|
| `approve_site(p_site_id, p_to, p_note)` | is_manager | 校验 p_to ∈ ('candidate','selected') ∧ 转换合法（surveying→candidate / candidate→selected）→ insert log(action=approve_*) → update site.status（GUC 已置，触发器放行） |
| `hide_site(p_site_id, p_note)` | is_manager | from ∈ (surveying,candidate,selected) → log(hide) → status='archived' |
| `restore_site(p_site_id, p_note)` | **is_admin** | target = 最后一条 to_status='archived' 的 log.from_status（无则 'surveying'）→ log(restore) → status=target |

**surveying 的产生不走 RPC**：调查员 insert site（default 'surveying'）+ 触发器写首条 log（action='submit'）。

# 七、Storage 设计

| 项 | 设计 |
|----|------|
| 桶 | `photos`，**private**，无公开前缀 |
| 路径 | `{project_code}/{site_code}/{sha1}.jpg` |
| 策略 | INSERT：authenticated；SELECT：**authenticated 全桶**（签名 URL 签发前提）；UPDATE/DELETE：无授权 |
| 粒度说明 | Storage 层不做 archived 粒度（对象路径不出库式校验代价高）——归档粒度由 DB 元数据层承担：archived site 的照片墙在看板不可达（无入口），直连签名 URL 属「拿到链接即可看」与现状 Sheet 同级暴露，短时效 token 缓解 | 
| INSERT 校验（复审 R4） | v1 **放弃对象名前缀/站点存在性校验**（放弃原因记档，避免静默降权）：桶私有+仅 staff 账号+无 upsert，授权点在 photo 表元数据 RLS（site_id FK）。升级路径：C2 加 EXISTS(非 archived site 前缀匹配) 策略 |
| 调阅 | 签名 URL 短时效（300s）+ **lazy 签发、img onerror 重签**（评审 L7） |

# 八、迁移步骤（编号 D1-D5，**与 PRD §七 S1-S6 分属两轴：S=平台切换步骤，D=数据库层动作**，评审 M5）

```text
D1 建枚举+10 表+索引+geog 生成列（L5 day-1 验证点；回滚=drop，零风险）
D2 REVOKE DELETE + RLS 策略 + 辅助函数 + 触发器（definer/search_path 钉死）+ RPC + 种子数据（project/domain_config/app_user + **svc_migration 机器账号**——无 auth.users 行，复审 R7）
   （幂等 SQL；回滚=drop 对象）
D3 SQL 用例验证（sql_cases.sql，不通过不进 D4）：
   ① 三角色×操作矩阵（R4）② 状态机合法/非法转换（R2，含 manager 直改 status 被拒——H3 回归用例）
   ③ 触发器断言：首条 submit log、audit old→new（R8）④ 跨项目隔离（R17）⑤ 匿名零权限（N1）
D4 存量数据导入（secret key，本机；**专用账号 svc_migration**（app_user，role=surveyor 级但仅 service 持有）：
   会话 SET app.migration='on' + SET app.actor_uuid=<svc_migration uuid>（实现补充 09-04：service 会话 auth.uid()=null，触发器写 log 的 actor 兜底取此 GUC）→
   site（含 archived 退役点，触发器放行）+ survey_result(source='migration') + fengshui_eval
   + 历史 log 回填：action='migration'、at=Sheet Added 日期、from=null→to=实际 status（评审 M7 时间线不失真）
   回滚=迁移窗口内按归属清理（评审 M6）：仅 secret key、仅 D4 窗口，删除顺序
   photo→survey_result→fengshui_eval→site_status_log(actor=svc_migration)→site（FK restrict 要求子表先行）
   运行期该路径不存在（app.migration 仅迁移会话设置）
D5 存量照片上传 Storage+photo 登记（幂等：sha1 已存在跳过；可整体重跑）
```

# 九、兼容性承诺

| 项 | 承诺 |
|----|------|
| 既有数据 | Sheet/JSON 源只读不改；D4/D5 幂等可整体重跑 |
| 既有管线 | PRD S5 退役前 Apps Script 通道可用；退役后 30 天可复活（回灌脚本备好） |
| 既有测试 | 主线仓不动；本仓 sql_cases+selftest |
| 禁止 | 运行期物理 DELETE（含授权层回收，§一）；为新功能破坏既有数据 |
