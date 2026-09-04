# TASK-011：看板骨架移植 + 登录墙（M3a 起步）
状态：TODO（前置：TASK-004；Atlas T22 骨架**复制**到本仓 `web/dashboard/`，不在原仓动刀）
目标：Atlas 骨架落位（index/leader/work/lib/tokens.css/api.js/config.js/selftest），接 supabase-js 数据源，登录墙生效
输入：docs/Design/04-Module.md M-Dash；docs/Design/03-API.md §2.1/§2.3；主线仓 Atlas T22 页面；N5 tokens.css 先行
验收条件：
1. 骨架文件齐：index.html（登录墙：未登录→Auth UI）+leader.html+work.html 空壳+api.js+config.js（部署注入位）+tokens.css
2. 登录后 leader/work 按 app_user.role 放行：surveyor 无看板入口（03 §2.3 RLS 兜底断言）
3. 骨架 pin/灯箱渲染以 TASK-006 迁入照片+迁入点位跑通一次（数据源已换 api.js）
4. `#/selftest` 无头 Edge 出 dump 证据：登录墙拦截/登录放行/权限分流
审查结论：（完工时填）
