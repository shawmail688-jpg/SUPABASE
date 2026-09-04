# TASK-013：Cloudflare Pages 部署 + 域名 + 领导手机实开（M3a 验收）
状态：TODO（前置：TASK-012；阻塞项：域名——公司现成或购买 ≈¥70/年）
目标：web/dashboard 上线 Pages，自定义域名 HTTPS，领导手机实开通过（ADR-007/R18）
输入：docs/ADR/ADR-007；docs/Design/01-Architecture.md §二托管要点；PRD R14/R18
验收条件：
1. Pages 项目建成，git push 触发部署流水；config.js 注入 URL+anon key（service key 不在任何前端产物中——产物 grep 断言）
2. 自定义域名 HTTPS 200（curl 证据）
3. 领导手机（外网）实开：登录/地图/照片/审批全可用，截图留档（用户验收记录）
4. 国内可达性实测：不达标→启用 cloudflared 命名隧道兜底并复测（ADR-007 回退路径）
审查结论：（完工时填）
