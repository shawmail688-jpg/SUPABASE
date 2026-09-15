# API 设计（API）

Version：1.2（1.1→1.2：复审 R1/R2/R3/R6 处置；1.0→1.1：首轮评审 H1/H2/M3/M4/M9/L4/L7 处置，见 ReviewRecord）
Status：Approved（L2 闸门 2026-09-04 用户批准，Lock；变更走 C2）
Author：Claude
Last Update：2026-09-03

> 本系统**无自有后端**：API 面 = Supabase 自动生成（PostgREST + Storage + Auth + Realtime + RPC）。
> 消费方：看板与（未来）表单页托管于 **Cloudflare Pages**（ADR-007）；调查表单 M2b 仍为单文件分发（04-Module M-Form）。
> 本文档定义前端/脚本消费这些端点的**契约与规则**；RLS 是越权的最终裁决（02-Database §五）。

---

# 一、API 规范

| 项目 | 内容 |
|------|------|
| Base URL | `https://<project-ref>.supabase.co`（区域开户前拍板，PRD 开放问题 #1/#2） |
| Style | REST（PostgREST 自动生成）；JSON over HTTPS |
| Auth | `apikey: <publishable key>` + `Authorization: Bearer <用户 JWT>`（登录后）；secret key 仅本机脚本 |
| 凭证注入 | URL + publishable key 经 `config.js` 随 Pages 部署注入——**publishable key 非密钥**（设计上公开，RLS 才是闸），secret key 永不进 config（ADR-007） |
| CORS | Supabase 端点默认放行所有 origin（托管域/file:// 均可调）；`file://` 场景可达性列入 **day-1 最小闭环实测清单**（评审 M9②） |
| 时间 | ISO 8601 UTC |
| 统一错误 | HTTP 4xx/5xx + `{code, message, details, hint}`；RLS 拒绝=空集（读）或 42501（写）；状态机违规=P0001（触发器/RPC raise，中文可读） |
| 幂等 | 客户端预生成 uuid + 稳定店面 site code + 照片 sha1 内容寻址 + **主键冲突=成功跳过**（评审 L4）→ 同一提交的重试/离线重放零副作用；用户编辑重发是新业务版本，必须使用新 uuid |

# 二、端点设计

## 2.1 登录（Auth）

`POST /auth/v1/token?grant_type=password` `{email, password}` → `{access_token, refresh_token, user}`

- 一人一号，admin 建号（两步：Studio auth.users + app_user 定角色，02 §3.3）
- 看板与表单共用同一 Auth；会话由 supabase-js 持久化 refresh_token

## 2.2 表单提交（M2b 换靶核心契约）

> 前置：表单持用户 JWT（M-Form auth 模块）；调查员经 `GET /rest/v1/site?code=eq.<code>&status=neq.archived` 解析存量点的 site_id（评审 H1 处置：读=非 archived 全量）；本机新建点直接用预生成 uuid。code 解析为空时**先查 archived**（`status=eq.archived`）：命中 → 提示「该店已隐藏，联系管理员恢复」，**禁止落入新建路径**（复审 R3：否则 upsert 撞唯一约束转 UPDATE 被 RLS 拒，提交无可读地永久失败）。**补充（09-04 预写 SQL 时发现）**：surveyor 经 RLS 本就看不到 archived 行，其侧该查询同样为空——故 adapter 对 site upsert 的 **42501 错误统一映射为「该店已隐藏或无权操作」**提示（manager/admin 侧则能直接命中 archived 行）；SQL 用例 T22 固化此行为。

三步顺序调用（任一步失败整体可重试——幂等）：

### ① 照片直传

```
POST /storage/v1/object/photos/{project_code}/{site_code}/{sha1}.jpg
Headers: Authorization: Bearer <JWT>; Content-Type: image/jpeg
201 → 成功；409（已存在）→ 视为成功（内容寻址幂等）；其他 4xx/5xx → 离线队列重试
```

### ② site upsert（幂等建点）

```
POST /rest/v1/site?on_conflict=project_id,code
Headers: Prefer: resolution=merge-duplicates,return=representation
[{ id:<预生成uuid>, project_id, code, name, grp, address, lat, lon }]
```

- **真实语义（评审 H2 纠正）**：merge-duplicates = `ON CONFLICT DO UPDATE SET col=EXCLUDED.col`——**payload 里的显式 null 会覆盖既有值**（PostgREST 无「null 跳过」内置语义）
- 保护机制：site BEFORE UPDATE 触发器对**文本列（grp/address）**做 `NEW.col=COALESCE(NEW.col,OLD.col)`（02 §6.1③）——**null 到达 DB 层被还原为旧值**，清空须发空字符串 `""`（工作视图编辑同理）；**lat/lon 不设 COALESCE（复审 R2）：显式 null=清空坐标**（改「未知」），表单/工作视图对坐标列始终携带当前值
- 新点：触发器保证 status='surveying' + 首条 site_status_log(action='submit')；`created_by` 不传，落库默认 `auth.uid()`（评审 M3）

### ③ 调查结果 + 照片元数据（主键冲突=成功）

```
POST /rest/v1/survey_result?on_conflict=id
Headers: Prefer: resolution=ignore-duplicates
{ id, site_id, rent, space, contact, surveyor_name, added_date, created_at:<surveyed_at>, raw:{currency:"USD",surveyed_at,supersedes,site_code,...}, source:"form" }
POST /rest/v1/photo?on_conflict=id     （每张一行；sha1 重复由 unique 约束拒，捕获后视为已登记）
{ id, site_id, storage_path, sha1, kind:"normal"|"detail", taken_at }
```

- **离线重放与修订语义（评审 L4 + CR-004）**：同 uuid 重放 → ignore-duplicates 跳过（2xx）=幂等成功，队列条目可清除；历史编辑重发生成新 uuid，`raw.supersedes` 指向来源版本，服务端允许并存。相同 `site_id` 的当前投影取最新 `raw.surveyed_at`，不删除旧版本
- `created_by`/`uploaded_by` 不传，默认 `auth.uid()`（评审 M3）

### 业务规则

- raw 保存表单全量字段（domain_config 结构）；列只提升看板用的字段
- 离线队列回网：按队列顺序重放 ①②③；单条失败标 error 不阻塞后续；**未登录/401 时入队不发送，回网先重登再 flush**（M-Form auth 模块）
- 双写期（PRD S4）：同一提交 `dual` 模式双发；对账口径见 §三

## 2.3 看板读取（PostgREST 直查，RLS 裁决）

| 查询 | 端点 | 说明 |
|------|------|------|
| 汇总条 | `GET /rest/v1/site?select=status&project_id=eq.<pid>&status=neq.archived` | 客户端 count 分组（≤20 店不分页） |
| 地图 pin | `GET /rest/v1/site?select=id,code,name,grp,status,lat,lon&project_id=eq.<pid>&status=neq.archived` | 管理层恢复视图另查 archived（仅 admin 入口） |
| 店面卡/详情 | `GET /rest/v1/site?select=*,survey_result(*),photo(*)&project_id=eq.<pid>&code=eq.<code>` | project_id 必带（复审 R6）；survey_result 按 `raw.surveyed_at` desc，缺值回退 created_at；卡片展示首条，详情保留全历史 |
| 状态时间线 | `GET /rest/v1/site_status_log?site_id=eq.<id>&order=at.desc` | 谁在何时批的/藏的 |
| CSV 导出 | 同 pin+详情查询 → 客户端拼 CSV | M3b |

## 2.4 签名 URL（照片调阅）

```
POST /storage/v1/object/sign/photos/{path}  {expiresIn: 300}
→ {signedURL}   浏览器 GET 直连，过期 4xx
```

- **lazy 签发**：进入视口/打开灯箱才签；`<img onerror>` 触发重签（评审 L7——300s 短时效与浏览时长冲突的消解）

## 2.5 审批 RPC（状态机唯一写入口）

```
POST /rest/v1/rpc/approve_site   {p_site_id, p_to:"candidate"|"selected", p_note}   （manager+）
POST /rest/v1/rpc/hide_site      {p_site_id, p_note}                              （manager+）
POST /rest/v1/rpc/restore_site   {p_site_id, p_note}                              （仅 admin）
```

- 角色不足/非法转换 → PostgREST 错误（P0001，中文可读）；**绕过 RPC 直改 status 的 PATCH 一律被触发器 GUC 闸拒绝**（02 §6.1，评审 H3）

## 2.6 Realtime（阶段一基线：调查提交推送）

```
supabase.channel('survey-feed')
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'site'}, cb)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'survey_result'}, cb)
```

**定档（评审 M9③，PRD 开放问题 #5 关账）**：阶段一基线=仅调查提交推送（新点冒 pin/新调查刷新）；编辑/批准/隐藏的全事件自动推送 **v1 不做**（刷新即最新已满足一致性承诺），后续真实需要再走 C2。

# 三、契约变更（对既有管线）

| 端点/通道 | 变更 | 兼容策略 |
|-----------|------|----------|
| Apps Script 直传通道 | 上传靶 GAS → Supabase（M2b） | 双写过渡：S4 期 `dual` 双发；S5 零差异后退役冻结；30 天可复活（回灌备件） |
| Atlas 数据源 | 看板换 supabase-js（M3a） | 旧 Atlas 页保留至新看板验收通过；atlas_bridge 验收后退役 |

**双写对账口径（评审 M4 纠正——按 Sheet 实有列，评审者已核 `survey_writeback.gs`：Showroom Sites 仅 B..J；复审 R1 修正过滤条件）**：
`reconcile_dualwrite.mjs` 每日跑，比对 PG（**source='form' ∧ added_date ≥ S4 起始日** 的行——dual 窗口表单提交在 PG 侧 source 恒为 'form'，若按 v1.1 的 source='appscript' 过滤则恒空集、退役闸门假阴性）↔ Sheet 同窗口行；**pin 列为 http(s) 链接的行跳过坐标比对**（无解析 ground truth；其余列照比，差异清单点名）：`building↔name`、`Added↔added_date`、`Surveyor↔surveyor_name`、`rent_per_sqm↔rent`、`space↔space`、`pin↔lat/lon`；**照片 sha1 只在 PG↔本地照片目录之间比对**（Sheet 无照片字段）；零差异连续 7 天 → 触发退役 checklist。

# 四、接口总览

| 模块 | Method | Endpoint | 说明 |
|------|--------|----------|------|
| Auth | POST | /auth/v1/token | 登录（一人一号） |
| 照片 | POST | /storage/v1/object/photos/{path} | 压缩直传（409=成功） |
| 照片调阅 | POST/GET | /storage/v1/object/sign + signedURL | lazy 签发+onerror 重签 |
| 表单 | GET | /rest/v1/site?code=eq. | 存量点解析（非 archived） |
| 表单 | POST | /rest/v1/site?on_conflict | upsert 建点（COALESCE 闸防 null 覆盖） |
| 表单 | POST | /rest/v1/survey_result, /rest/v1/photo（on_conflict=id ignore-duplicates） | 主键冲突=成功 |
| 看板 | GET | /rest/v1/site, /rest/v1/site_status_log, ... | RLS 裁决直查 |
| 审批 | POST | /rest/v1/rpc/approve_site, hide_site, restore_site | 状态机唯一入口 |
| 实时 | WS | Realtime channel（survey-feed） | 调查提交推送（基线定档） |
| 无 | — | 自定义 Edge Function | 本版无（M5/归档轨道才引入） |
