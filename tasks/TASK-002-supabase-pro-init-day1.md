# TASK-002：Supabase Pro 开户 + day-1 最小闭环原型验证
状态：DONE（2026-09-14；day-1 五项全 PASS，机器证据 docs/features/v1-launch/day1/；首月免费档验证、次月起 Pro $25/月）
目标：远端项目落地，day-1 验证清单全链实测（TD-001 消解：Supabase 无原型，任何踩坑在此暴露后才铺开）
输入：docs/Design/01-Architecture.md §6.1；docs/ADR/ADR-001；TECH_DEBT.md TD-001
验收条件：
1. 远端项目建成（区域=TASK-001 拍板值；首月 Free、次月 Pro）；secret key 存本机 `.env`（不入 git），`.env.example` 登记
2. day-1 清单逐项留机器证据：①建 1 测试表+RLS 用例（anon 零/角色判定）②Storage 私有桶签名 URL 签发+过期 4xx③浏览器直传照片成功④Realtime 订阅收到 INSERT⑤单文件表单从 file:// 调 REST 端点成功（CORS 实测）
3. 任一项失败→踩坑记录入 docs/features/v1-launch/（方案不换则记 TECH_DEBT/ADR 修订）
审查结论：✅ 五项全 PASS（2026-09-14）。
- 验收 1：项目 `jfggeudssomocwcnpawk` region=**eu-central-1（Frankfurt）**、status=ACTIVE_HEALTHY（Management API 权威确认，day1/region.json）；`.env.example` 以 SUPABASE_PUBLISHABLE_KEY/SUPABASE_SECRET_KEY/ACCESS_TOKEN/DB_URL 建档（CR-001 新式命名，ApprovalRecord #6）；`.env` 本机就位不入 git
- 验收 2①：day1_private_notes 表 + RLS（owner 私有）——service 插入 201/读取 1 行，anon 读取 0 行（anon 零）、插入 401 拒绝（sql_rls.log）
- 验收 2②：私有桶 day1-private + 上传 200 + 签名 URL(5s) 立即 200、过期后 400 InvalidJWT exp（storage_signed_url.log）
- 验收 2③：应用内真实 Edge fetch 直传 1x1 PNG 至私有桶 PASS(200)（realtime.log 测试3）
- 验收 2④：Node24 WebSocket 客户端 join → REST 插入 201 → 3.9s 收到 postgres_changes INSERT（realtime.log 测试4，全量诊断日志）；浏览器侧同样 PASS（dom_browser.txt）
- 验收 2⑤：file:// 页面 fetch REST GET 200（day1_cors.html，title=DAY1_CORS_PASS；dom_cors.txt）
- 踩坑（已留档，方案不变）：①Storage API 新式 sb_secret_ key 须带 `apikey` 头（PostgREST 单 Bearer 即可），否则 Invalid Compact JWS；②anon 上传勿带 `x-upsert` 头（触发 upsert 路径内部 SELECT，无 select 权限即 RLS 拒绝）；③签名 URL 窗口须 ≥5s（2s 被网络往返吃掉）；④本机到部分 Cloudflare 边缘 IP 偶发连接超时，REST 调用带重试即可
- 测试残留清理完毕：两张测试表/publication/存储策略/桶及对象全部删除
- RTT 存档（TASK-001 兜底条款）：Frankfurt median 118ms（rtt_frankfurt.txt）

执行注记（2026-09-14）：Supabase 新式 publishable/secret key 迁移见 CR-001（已批准 Lock，ApprovalRecord #6）。

远端预检（2026-09-14）：`jfggeudssomocwcnpawk.supabase.co` DNS A 记录可解析；无 API key 请求 REST/Auth 端点均返回 HTTP 401，证明项目入口已上线且未匿名放行。Region 已由 Management API 确认 eu-central-1。
