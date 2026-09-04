# TASK-002：Supabase Pro 开户 + day-1 最小闭环原型验证
状态：TODO（阻塞：TASK-001 拍板 + 用户付款 $25/月）
目标：Pro 项目落地，day-1 验证清单全链实测（TD-001 消解：Supabase 无原型，任何踩坑在此暴露后才铺开）
输入：docs/Design/01-Architecture.md §6.1；docs/ADR/ADR-001；TECH_DEBT.md TD-001
验收条件：
1. Pro 项目建成（区域=TASK-001 拍板值）；service key 存本机 .env（不入 git），`.env.example` 登记
2. day-1 清单逐项留机器证据：①建 1 测试表+RLS 用例（anon 零/角色判定）②Storage 私有桶签名 URL 签发+过期 4xx③浏览器直传照片成功④Realtime 订阅收到 INSERT⑤单文件表单从 file:// 调 REST 端点成功（CORS 实测）
3. 任一项失败→踩坑记录入 docs/features/v1-launch/（方案不换则记 TECH_DEBT/ADR 修订）
审查结论：（完工时填）
