# TASK-001：Supabase 区域拍板实测（RTT 证据）
状态：TODO（阻塞：需用户注册 Supabase 免费账号）
目标：开户前用免费档在 Frankfurt/新加坡两区域各建临时项目，实测 RTT 出证据，支撑区域拍板（PRD 开放问题 #1/#2 关账）
输入：docs/PRD/PRD-V1.md §十 开放问题 #1/#2；docs/Design/01-Architecture.md §6.1 day-1 清单；docs/ADR/ADR-001（变更记录待填）
验收条件：
1. 两区域临时项目各测：分部办公网→Supabase REST 端点 RTT（curl 计时 10 次取中位数）；领导侧（手机流量）同测
2. 证据表（区域×测点×中位 RTT）写入 ADR-001 变更记录
3. 用户拍板区域并记录在案（拍板动作=用户，本任务交付的是证据）
审查结论：（完工时填）
