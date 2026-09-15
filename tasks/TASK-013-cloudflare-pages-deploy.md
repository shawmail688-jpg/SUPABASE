# TASK-013：Cloudflare Pages 部署 + 域名 + 领导手机实开（M3a 验收）
状态：IN REVIEW（前置：TASK-012；域名由用户已配置）
目标：web/dashboard 上线 Pages，自定义域名 HTTPS，领导手机实开通过（ADR-007/R18）
输入：docs/ADR/ADR-007；docs/Design/01-Architecture.md §二托管要点；PRD R14/R18
验收条件：
1. Pages 项目建成，git push 触发部署流水；config.js 注入 URL+publishable key（secret key 不在任何前端产物中——产物 grep 断言）
2. 自定义域名 HTTPS 200（curl 证据）
3. 领导手机（外网）实开：登录/地图/照片/审批全可用，截图留档（用户验收记录）
4. 国内可达性实测：不达标→启用 cloudflared 命名隧道兜底并复测（ADR-007 回退路径）
5. Pages 域名实测街道/卫星两类瓦片均返回图片；部署配置可切换供应商且无需改业务代码；主瓦片故障注入通过（ADR-008）
审查结论（2026-09-15）：

- Cloudflare Pages Direct Upload 已通过 API 完成，无 Wrangler/新软件安装；项目 `uganda-house-finder` 已建立并复用。
- 部署 `98e69696-8ca8-4c3d-bb88-f9f802d5b4ea`，提交 `18980f8a0a6c7dfa7fee9aeb1c9fe7385f96d301`，状态 `deploy=success`。
- 生产域名：[uganda-house-finder.pages.dev](https://uganda-house-finder.pages.dev)；部署 URL：[98e69696.uganda-house-finder.pages.dev](https://98e69696.uganda-house-finder.pages.dev)。`/`、`/lib/app.js`、`/leader.html`、`/work.html` 均 HTTP 200；Edge headless `#/selftest-full` 为 `7/7`。
- 仍待用户验收：自定义域名 HTTPS、领导手机外网登录/地图/照片/审批、国内可达性及街道/卫星瓦片实测。完成后再将 TASK-013 置 DONE。
