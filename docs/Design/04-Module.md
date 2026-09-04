# 模块设计（Module）

Version：1.1（1.0→1.1：架构评审 M4/M6/M7/M8/L6 处置，见 ReviewRecord）
Status：Approved（L2 闸门 2026-09-04 用户批准，Lock；变更走 C2）
Author：Claude
Last Update：2026-09-03

> 只详设三个复杂模块：M-Form 换靶、M-Dash 看板、M-Mig 迁移工具。状态机已收口在 DB 层（02-Database §六），不另设模块。

---

# 一、M-Form：表单换靶（M2b）

## 职责

- 做什么：既有离线单文件表单的**上传靶抽象化**——Apps Script 与 Supabase 双 adapter，配置切换；离线队列原样保留；**新增 Auth 登录态**（RLS 要求调查员 JWT）
- 不做什么：不改表单字段/交互/校验逻辑（**Auth 登录为唯一显式豁免**——评审 M8）；不做看板功能；分发方式不变（v1 定档：维持单文件分发，01 §6.2）

## 内部结构（在既有单文件内改造）

```text
upload-adapter（新增）
  ├ auth.js                登录页/表单 + supabase-js 会话持久化（refresh_token 本地存）
  │                        401/未登录 → 入队不发送；回网先重登再 flush
  ├ adapter-appscript.js   现有直传逻辑原样封装
  ├ adapter-supabase.js    03-API §2.2 三步契约（photo→site upsert→survey+photo_meta）
  ├ selector               配置常量 target:'appscript'|'supabase'|'dual'（S4 双写用）
  └ 离线队列（既有）        队列元素带 target 标记；回网按 adapter 重放；uuid 预生成幂等
```

## 对外接口

| 接口 | 契约 | 调用方 |
|------|------|--------|
| `submit(payload)` | payload=表单全量+照片 blob 数组；返回 `{ok, error?}`；内部处理三步与重试 | 表单提交入口 |
| `flushQueue()` | 断网恢复后逐条重放；单条失败标 error 不阻塞 | 联网事件 |

## 关键设计

- **幂等**：site/survey_result/photo 的 uuid 由表单预生成（`crypto.randomUUID()`）；照片 sha1 内容寻址——重试、重复提交、双写错位均零副作用
- **压缩**：既有拍照→canvas 压缩（默认档：长边 clamp 1600-2000、JPEG q≈0.8；细节照开关→高质量档，参数 M2a 定档开放问题 #7）；压缩在 worker/主线程本地完成
- **双写（PRD S4）**：`dual` 模式先发 supabase 再发 appscript，任一失败进各自队列；对账期间新字段只在 supabase 侧（GAS 通道结构冻结）；对账口径与脚本见 M-Mig `reconcile_dualwrite.mjs`
- **分发**：M2b 沿用单文件分发现状（换靶只是文件内容更新；URL+SW 缓存延后，01 §6.2）

## 测试要点

- 断网→回网全链路（含照片）队列重放成功；重复重放零重复行（uuid 断言）
- dual 模式两通道数据一致（对账脚本口径）
- 压缩输出断言（长边/体积档位）

---

# 二、M-Dash：看板（M3a 领导视图 / M3b 工作视图）

## 职责

- 做什么：Atlas T22 骨架**复制改造**——登录、双视图、审批操作、Realtime、CSV 导出、selftest；**部署 Cloudflare Pages**（评审 H4：git push 触发，`config.js` 注入 URL+anon key——ADR-007）
- 不做什么：不做表单；不做监控区块（M5 后续项目）

## 内部结构（`web/dashboard/`）

```text
dashboard/
  ├ index.html            单页入口（登录墙：未登录→Auth UI）
  ├ leader.html           领导视图（手机优先三层：汇总条/地图+卡片/详情）
  ├ work.html             工作视图（桌面：表格/详情编辑/恢复入口/CSV）
  ├ lib/                  Atlas 骨架复用件：map(pins/弹窗)、lightbox、卡片渲染
  ├ api.js                supabase-js 封装（03-API 契约）
  ├ config.js             Supabase URL+anon key（部署注入，ADR-007；anon key 非密钥，RLS 才是闸）
  ├ tokens.css            设计 token（N5：色彩/状态色/字体/间距——先落 token 再写 UI）
  └ selftest              #/selftest 无头自检（沿用主线 headless Edge 模式）
```

## 对外接口

| 接口 | 契约 | 调用方 |
|------|------|--------|
| 数据读取 | 03-API §2.3 直查（RLS 裁决） | 两视图 |
| 审批操作 | RPC approve/hide/restore（03-API §2.5） | 按钮（按角色渲染） |
| Realtime | channel `survey-feed`（INSERT site/survey_result） | 领导视图冒 pin |

## 关键设计

- **骨架复用映射**：pin 渲染/弹窗卡/照片灯箱/去重/destack 逻辑零改；只把「数据源（静态 JSON/Sheet 拉取）」换成 api.js；风水卡渲染保留（fengshui_eval 迁移后数据源同换）
- **权限可见性矩阵**（PRD §4.4）：按钮渲染查 app_user.role；RLS/RPC 兜底——两层一致由 selftest 断言（manager 见批准/隐藏不见恢复；admin 见恢复；surveyor 无看板入口）
- **状态色**：surveying/candidate/selected/archived 四色 token，汇总条与 pin 同源（PRD §4.1）
- **手机视口**：领导视图 E2E 以 375px 宽跑 selftest（N3）
- **selftest 证据**：无头 Edge dump-dom 出机器证据（既有 pattern），覆盖：登录墙、汇总条筛选、pin→卡片、按钮可见性、恢复入口、CSV 行数

## 测试要点

- 三角色 × (看板入口/批准/隐藏/编辑/恢复/导出) 可见性与可操作性矩阵（DOM+RPC 双层断言）
- 批准闭环：RPC → site_status_log 出现对应行 → 汇总条数字变化
- 离线不涉及（看板在线工具，不做离线）

---

# 三、M-Mig：迁移工具（M1 数据 / M2a 照片）

## 职责

- 做什么：Sheet 双表+survey_points.json+fengshui_evals.json → PG；本地照片 → Storage+photo 表；sha1 对账报告；PG→Sheet 回灌（S5 应急备件）
- 不做什么：不做双向同步（ADR-005）；不修改源数据（只读）

## 内部结构（`scripts/`）

```text
scripts/
  ├ migrate_data.mjs       三源→PG（service key，.env 读密钥；幂等 upsert by code/uuid）
  ├ migrate_photos.mjs     本地照片目录→sha1 去重→Storage 上传→photo 登记（幂等重跑）
  ├ reconcile.mjs          对账：DB vs 源，行数+逐行 sha1 → rows_match:true 报告存档
  ├ reconcile_dualwrite.mjs S4 双写对账（评审 M4）：PG(source='appscript') ↔ Sheet 列 B..J；口径见 03-API §三
  ├ backfill_sheet.mjs     PG→Sheet 增量回灌（S5 退役后复活 Apps Script 前置，备件）
  ├ sql_cases.sql          D3 用例：三角色矩阵/状态机非法转换（含 manager 直改 status 被拒——H3 回归）/触发器断言/跨项目隔离 R17（psql 跑）
  └ pg_dump_backup.ps1     每日冷备计划任务 + restore_drill.ps1 恢复演练
```

## 关键设计

- **映射规则**：Sheet 点位 ID→site.code；照片按目录名/Sheet 关联挂 site；surveyor 名字保留原文（surveyor_name）+ 归属署名 **svc_migration 专用账号**（评审 M6：app_user 内建号，service key 唯一持有者，role=surveyor 级）
- **迁移会话**：`SET app.migration='on'` 方可写 status/建 archived 行（GUC 闸旁路仅此一径，02 §6.1）；历史 log 回填 `action='migration'`、`at`=Sheet Added 日期（评审 M7：状态时间线不失真）
- **照片源目录（评审 L6②）**：只读迁出；具体路径在 M2a 任务单开工时从 `build_showroom_atlas.py` 配置锁定，锁定后写入任务单不再漂移
- **对账口径**：行数一致 ∧ 每行关键字段拼接 sha1 一致（双表各自算）→ `rows_match:true`；差异输出清单人工裁决后重跑
- **迁移数据隔离**：全部 `source='migration'`——S4 期可整库清迁移数据重来（唯一允许的批量删除，仅 service key）
- **照片去重**：sha1 全局唯一约束兜底；已存在跳过（幂等）

## 测试要点

- 干跑模式（--dry-run）：只出映射报告不写库
- 重跑幂等：连跑两次第二遍零新增
- 对账脚本：人为改一行源→rows_match:false 且差异行被点名

---

# 四、依赖关系

| 依赖 | 用途 | 是否新增（需审批） |
|------|------|--------------------|
| supabase-js v2 | 前端/脚本唯一 SDK | ✅ 新增（架构闸门批准：ADR-001 随附） |
| PostGIS 扩展 | geog 生成列（Supabase 内置可 enable） | 平台内置 |
| 无构建链/框架 | 看板与表单维持原生 HTML+JS（Atlas 同款） | 否（小系统纪律） |
| Headless Edge | selftest 机器证据 | 已有（主线在用） |
