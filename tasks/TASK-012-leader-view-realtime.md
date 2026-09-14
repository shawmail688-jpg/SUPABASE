# TASK-012：领导视图 leader.html（M3a 主体：汇总条/地图/卡片/Realtime）
状态：TODO（前置：TASK-011 + TASK-005）
目标：手机优先三层（汇总条/地图+卡片/详情）+审批按钮（批准/隐藏）+Realtime 调查提交冒 pin+签名 URL lazy 调阅
输入：docs/Design/04-Module.md M-Dash；docs/Design/03-API.md §2.3/§2.4/§2.5/§2.6；PRD §4.1 状态色/R14
验收条件：
1. 汇总条四态计数与 DB count 一致（对拍断言）；区域筛选生效
2. pin→卡片→详情（含历次调查+照片灯箱）全链；签名 URL 过期后 img onerror 重签恢复
3. 批准/隐藏走 RPC：成功→site_status_log 出行→汇总条数字变化（闭环断言）；非 manager 按钮不渲染且 RPC 越权拒
4. Realtime：另端提交→leader 视图 ≤3s 冒 pin（本地实测记录）
5. 375px 视口 selftest 全绿（N3）+out dump 证据
6. 瓦片故障注入：拦截 streetUrl，断言 3 次失败后卫星瓦片实际加载且 pin/卡片仍可操作
审查结论：（完工时填）
