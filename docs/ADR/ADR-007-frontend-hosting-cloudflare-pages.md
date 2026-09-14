# ADR-007：看板与前端静态资产托管于 Cloudflare Pages

Status：Accepted
Date：2026-09-03
决策者：用户（架构 L2 闸门，待最终批准）
来源：架构评审 H4（01-Architecture §二 托管层缺失）+ ADR-001 前端托管候选保留项

# 一、背景（Context）

- 看板是纯静态前端（无自有后端），需要一个托管宿主才能被领导手机访问——R14「领导手机实开验收」、R18「域名 HTTPS 200」此前无实现路径
- 办公室机器伺服（atlas_bridge 模式）反设计目标 1（办公室机器只承担冷备、可丢）；atlas_bridge 本就要在 M3a 验收后退役
- Supabase 只托管其自家 API，不托管任意静态站

# 二、决策（Decision）

看板（`web/dashboard/`）及未来表单 URL 形态托管 **Cloudflare Pages**：

- 免费档足够（静态站、无限带宽量级）；自定义域名绑定（开放问题 #3 的域名落点）；全球边缘节点（乌干达直连无障碍、领导国内可达性以实开验收为准，cloudflared 命名隧道兜底保留）
- 环境注入：`config.js` 随部署写入 Supabase URL + publishable key（**publishable key 设计上公开非密钥，RLS 才是闸**）；secret key 永不进 Pages
- 部署：git push 触发（或 wrangler 直传），零服务器

# 三、候选方案与取舍（Alternatives）

| 方案 | 理由 | 否决原因 |
|------|------|----------|
| **Cloudflare Pages** ✅ | 免费/边缘/自定义域名/与既有 cloudflared 兜底同厂 | — |
| GitHub Pages | 零成本 | 国内可达性不稳（领导侧风险）；自定义域 HTTPS 可行但 CDN 弱 |
| Netlify / Vercel | 功能相当 | 国内可达性同风险；免费档限额更紧 |
| 办公室机器伺服 | 零改动 | 反托管优先目标；机器关机=看板哑（现状之债） |
| 域名直指 Supabase | 少一跳 | Supabase 不托管任意静态站 |

# 四、验证证据（如经评估 / 原型）

- M3a 验收含：Pages 域名 HTTPS 200 + 领导手机实开；国内可达性若不达标 → cloudflared 命名隧道兜底（已验证模式）+ 必要时换 GitHub Pages 平迁（静态站零成本迁移）

# 五、后果（Consequences）

- 正面：办公室机器彻底退出在线链路（只剩冷备）；部署=git push；域名一次到位
- 代价 / 技术债：新增 Cloudflare 平台依赖（免费档，无 SLA）——静态站可分钟级平迁任意静态托管，锁定风险≈0
- 回退触发条件：领导侧持续不可达且隧道兜底不稳 → 换静态托管商（平迁）或评估国内可达 CDN

# 六、变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-03 | 建档 | 架构评审 H4：托管决策缺失 |
