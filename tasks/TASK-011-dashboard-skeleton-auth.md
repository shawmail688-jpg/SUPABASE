# TASK-011：看板骨架移植 + 登录墙（M3a 起步）
状态：IN REVIEW（2026-09-15：骨架、公开配置注入、登录墙/角色分流、latestSurvey 与真实 Leaflet 地图已实现）
目标：Atlas 骨架落位（index/leader/work/lib/tokens.css/api.js/config.js/selftest），接 supabase-js 数据源，登录墙生效
输入：docs/Design/04-Module.md M-Dash；docs/Design/03-API.md §2.1/§2.3；主线仓 Atlas T22 页面；N5 tokens.css 先行
验收条件：
1. 骨架文件齐：index.html（登录墙：未登录→Auth UI）+leader.html+work.html 空壳+api.js+config.js（部署注入位）+tokens.css
2. 登录后 leader/work 按 app_user.role 放行：surveyor 无看板入口（03 §2.3 RLS 兜底断言）
3. 骨架 pin/灯箱渲染以 TASK-006 迁入照片+迁入点位跑通一次（数据源已换 api.js）
4. `#/selftest` 无头 Edge 出 dump 证据：登录墙拦截/登录放行/权限分流
5. `config.js` 定义统一 `window.MAP_TILE_CONFIG`（streetUrl/satelliteUrl/errorThreshold）；产物不得出现 `tile.openstreetmap.org`，地图连续 3 个主瓦片失败后无需刷新自动切卫星图（ADR-008）
6. api.js 提供 `latestSurvey(site)`：按 `raw.surveyed_at` 倒序，缺值回退 `created_at`；同店历史不被丢弃
审查结论：本地 Review PASS。`web/dashboard/` 文件齐全；`#/selftest` 11/11（含 null 坐标防假 Pin、照片与风水卡渲染）；无 `tile.openstreetmap.org`；config 注入不含 secret；leader/work 使用同一 API 读取契约，surveyor 被挡在 field-form 入口；原占位地图已替换为真实 Leaflet/Esri 地图。真实登录与领导手机视觉验收留 TASK-013/015。
