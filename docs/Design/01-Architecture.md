# 选址调查数据平台 架构设计（Architecture）

Version：1.3（1.2→1.3：C2 地图瓦片长期可用性变更，见 ADR-008）
Status：v1.2 Approved/Lock；v1.3 C2 CR-002 In Review
Author：Claude
Last Update：2026-09-14
PRD 依据：`docs/PRD/PRD-V1.md` v1.1（Approved/Lock）

---

# 一、设计目标

沿用 CLAUDE.md 七条核心原则，落在技术侧即：

1. **托管优先**：零自建服务器——数据库/Auth/存储/备份全用 Supabase 托管能力；办公室机器只承担 pg_dump 冷备（可丢）
2. **DB 唯一权威**：一切读写直达 Postgres，RLS 是权限的唯一执行点；无第二事实源
3. **小系统纪律**：≤20 店十几人的规模基准——不过度分层、不引入后端框架、无 ORM（直 SQL 迁移 + supabase-js 客户端）
4. **离线灵魂**：表单侧离线能力是硬约束，架构只换「上传靶」，不动离线机制
5. **配置驱动复现**：project + domain_config 双轴预留，换电站=第二份配置
6. **安全内建**：RLS 两类角色 + 私有桶 + 服务端密钥纪律（本版无第三方凭证，纪律随 ADR-006 预置）
7. **地图可降级**：禁止前端直连 OpenStreetMap 公共标准瓦片；底图 URL/署名由 `config.js` 注入，主底图失败自动切备用底图（ADR-008）

# 二、总体架构

```
┌─ 客户端（纯静态，托管于 Cloudflare Pages——ADR-007）───────────┐
│                                                              │
│  调查表单（单文件 HTML，既有资产换靶；M2b 单文件分发）          │
│  ├ 在线：supabase-js 直传             看板（Atlas 骨架改造）   │
│  ├ 离线：本地队列攒单（原样保留）       ├ 领导视图（手机优先）   │
│  └ 照片：本地压缩→Storage 直传         ├ 工作视图（桌面）       │
│         │                             └ Realtime 订阅新提交    │
└─────────┼───────────────────────────────────┼────────────────┘
          │  HTTPS（publishable key + 用户 JWT）      │
          ▼                                   ▼
┌─ Supabase Pro（区域：Frankfurt/新加坡，开户前拍板）─────────────┐
│  PostgREST 自动 API（表直读直写，RLS 裁决）                    │
│  RPC：approve_site / hide_site / restore_site（状态机唯一入口）│
│  Postgres + PostGIS：10 表 + RLS + 触发器（audit/status_log）  │
│  Auth：一人一号（admin 建号）                                  │
│  Storage：photos 私有桶 + 签名 URL                             │
│  Realtime：调查提交 → 看板冒新 pin（阶段一基线）                │
└──────┬───────────────────────────────┬───────────────────────┘
       │ （S5 前）Apps Script 旧通道    │
       ▼  双写并行，对账零差异后退役     ▼
┌─ Google Sheet（历史存档）──┐   ┌─ 办公室机器（可丢层）─────────┐
│ S5 退役时冻结只读          │   │ 每日 pg_dump 计划任务          │
└───────────────────────────┘   │ → 本地冷备 + 恢复演练 runbook  │
                                └────────────────────────────────┘
```

**要点**：
- **无自有后端**：本版无 Edge Function（无第三方凭证可管）；状态机用 Postgres RPC（security definer + GUC 闸）而非应用层——权限判定与状态转换同点收口，且**强制层**杜绝绕过（02 §6.1）
- **托管定案（评审 H4）**：看板（及未来表单 URL 形态）托管 **Cloudflare Pages**（免费、静态、自定义域名、与 publishable key 公开设计兼容）——决策记录 ADR-007；域名（开放问题 #3）绑定 Pages，cloudflared 命名隧道仅兜底；`config.js` 注入 URL+publishable key（publishable key 非密钥，RLS 才是闸）
- **客户端拿到的只有 publishable key + 用户 JWT**；secret key 只存在于本机迁移/备份脚本（.env，永不入 git）
- **地图瓦片（ADR-008）**：首发默认使用 Esri World Street Map，World Imagery 为自动及手动备用；统一读取 `window.MAP_TILE_CONFIG`，后续采购带 SLA/域名鉴权的供应商时只改部署配置，不改地图业务代码
- 三层可用性递减：云上（权威、永不暂停）> Sheet 存档（只读快照）> 本地冷备（灾难恢复）

# 三、模块划分与职责

| 模块 | 职责 | 边界（不做什么） |
|------|------|------------------|
| M-DB 数据层 | 迁移 SQL（10 表/RLS/触发器/RPC）、索引、枚举 | 不含业务脚本；不做字段级历史 |
| M-Form 表单端 | 既有单文件表单换靶（上传靶抽象）、离线队列、照片压缩直传、Auth 登录态 | 不改表单字段与交互逻辑（**Auth 登录为唯一豁免**——04 M-Form）；不做看板 |
| M-Dash 看板端 | 领导视图+工作视图（Atlas 骨架换数据源）、审批操作、Realtime、CSV 导出、selftest | 不做表单；不做监控区块（M5） |
| M-Mig 迁移工具 | Sheet 双表+两 JSON→PG、存量照片→Storage、sha1 对账报告、PG→Sheet 回灌（S5 应急用） | 不做双向同步（ADR-005）；不修改源数据 |
| M-Ops 运维 | 每日 pg_dump 计划任务、恢复演练脚本、runbook | 不做监控告警（规模不需要） |

模块详设：M-Form/M-Dash/M-状态机/M-Mig 见 `04-Module.md`；数据模型见 `02-Database.md`；端点契约见 `03-API.md`。

# 四、关键数据流

## 4.1 调查员在线提交（主链路）

```
表单填写 → 压缩照片(本地) → supabase-js：
  1) POST /storage/v1/object/photos/{proj}/{site}/{sha1}.jpg   （直传）
  2) upsert site（code 幂等）→ 触发器写 status_log(surveying)
  3) insert survey_result(raw jsonb 全量) + insert photo(sha1 去重)
→ Realtime → 看板冒新 pin
```

## 4.2 离线攒单回网同步

```
断网：表单进本地队列（IndexedDB，uuid 主键）→ 恢复联网 → 队列逐条重放 4.1 三步
幂等保障：客户端生成 uuid PK + code upsert → 重试/重复提交零副作用
失败：条目回队列标记 error，下次再试（既有队列机制原样）
```

## 4.3 管理层审批（写路径唯一收口）

```
看板按钮 → RPC approve_site(site_id, 'candidate'|'selected', note)
         → RPC hide_site(site_id, note) / restore_site(site_id, note)（仅 admin）
RPC 内部（security definer，一个事务）：
  校验角色 → 校验转换合法（状态机表）→ insert site_status_log → update site.status
非法转换/越权 → raise exception（PostgREST 返回错误）
```

## 4.4 看板读取

```
登录（Auth JWT）→ supabase-js 直查（RLS 自动裁决范围）：
  汇总条：site 按 status count → 地图 pin：site+坐标 → 卡片：site+最新 survey_result+photo(签名 URL)
→ 批准/隐藏 → 4.3 → Realtime/刷新反映
```

## 4.5 存量迁移（一次性，M1/M2a）

```
Sheet 导出 CSV + survey_points.json + fengshui_evals.json
  → M-Mig 脚本（secret key，本机）→ PG 落库
  → 对账脚本：行数+逐行 sha1 vs 源 → 零差异报告存档
本地照片目录 → sha1 去重 → Storage 上传 → photo 表登记 → 计数对账
```

# 五、架构影响清单

| 影响 | 文件 / 位置 | 动作 |
|------|-------------|------|
| 既有文件修改 | `E:\uganda-house-finder` 表单单文件 | **分支上**换靶：上传靶抽象为 adapter（appscript / supabase 双实现，配置切换）；主线项目在 S5 前保持可用 |
| 既有文件修改 | Atlas 骨架（T22） | **复制**到本仓库 `web/dashboard/` 改造（不在原仓动刀）：数据源 Sheet→supabase-js、加登录/汇总条/审批 |
| 既有脚本冻结（评审 L6①） | 主线仓 `push_to_sheet.py` / `sheet_post.py` / `merge_spm.py` / `build_showroom_atlas.py` / `serve_atlas.py` | PRD S5（GAS 退役）与 S6（atlas_bridge 退役）各冻结一组；冻结=停计划任务+脚本头注记退役日期，不删文件 |
| 目录约定（新建） | 本仓库 `supabase/migrations/`、`web/`（form+dashboard）、`scripts/`（迁移+备份）、`.env.example` | git 分支纪律：编码走分支→PR→审后合 |
| 存量照片源（评审 L6②） | 主线仓 Atlas 照片目录（builder 配置中的照片根目录，具体路径在 M-Mig 任务单开工时以 `build_showroom_atlas.py` 配置锁定） | 只读迁出（sha1 去重），源目录不动 |
| 既有测试影响 | 主线管线自检（27/27） | 不回归原仓；本仓新建自检：`#/selftest`（看板）+ SQL 用例（RLS/状态机/跨项目隔离）+ 对账脚本 |
| Apps Script | 既有 GAS 通道 | S4 双写期保持；S5 退役冻结（30 天可复活，PG→Sheet 回灌脚本随 M-Mig 交付） |

# 六、技术评估结论与定档结论

## 6.1 未知项（day-1 最小闭环验证清单——M1 首日，任何踩坑在此暴露后才铺开）

- **Supabase 无原型**（TD-001）：建项目→建 1 表→RLS 用例→签名 URL→Storage 直传→Realtime 订阅，全链实测
- **区域延迟对比**（开放问题 #2）：开户前用免费档两区域临时项目各测 RTT（分部侧+领导侧），证据填 ADR-001 变更记录后拍板
- **geog 生成列 IMMUTABLE 验证**（评审 L5）：`::geography` cast 若拒建→降级触发器维护列
- **file:// 场景 CORS 实测**（评审 M9②）：单文件表单从 file:// 调 Supabase 端点
- **瓦片故障注入**：拦截主街道瓦片，断言 3 次失败后自动切到卫星底图；分别从 file://、localhost、Pages 域名实测（ADR-008）
- 压缩参数（开放问题 #7）：M2a 样本断言定档

## 6.2 定档结论（PRD 指派架构阶段定档的三项，评审 M9 关账）

| 项 | 定档 |
|----|------|
| 表单分发（PRD §五） | **v1 维持单文件分发现状**（M2b 只换内部直传靶）；URL 访问+Service Worker 离线缓存延后至 M3a 域名落地后按需评估（走 C2） |
| CORS/可达性 | Supabase 端点默认放行全部 origin；file:// 实测列入 6.1 day-1 清单 |
| 全事件 Realtime | 阶段一基线=仅调查提交推送；**v1 不扩**全事件（03 §2.6） |

- 评估证据落 ADR-001/004/007；原型验证记录落 tasks/ 对应任务单

# 七、迁移 / 兼容

迁移六步（S1-S6）每步可回滚 + 兼容承诺：见 `docs/PRD/PRD-V1.md` §七（Lock 文本，此处不复制）。

> 数据模型见 `02-Database.md`、API 契约见 `03-API.md`、复杂模块见 `04-Module.md`。
