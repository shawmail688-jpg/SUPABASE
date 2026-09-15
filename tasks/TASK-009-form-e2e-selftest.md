# TASK-009：表单 E2E 自检（离线重放/幂等/dual 双发）
状态：TODO（前置：TASK-008）
目标：换靶后的表单建立机器证据自检（沿用 #/selftest + 无头 Edge dump-dom pattern），覆盖换靶关键路径
输入：docs/Design/04-Module.md M-Form 测试要点；主线 headless Edge selftest pattern（D 盘记忆 headless-edge-selftest-pattern）
验收条件：
1. 自检用例全绿并出 dump 证据：①supabase 靶提交→DB 三表落行断言（uuid/created_by/source）②离线（断网模拟）→队列计数→回网 flush→零重复③同 uuid 重放第二次→零新增④dual 模式→PG 行+Sheet 行各一⑤压缩输出长边/体积断言（TASK-007 定档值）
2. 自检可重复跑（同环境连跑两遍全绿）
3. 结果附任务单审查结论
4. CR-004 回归：USD 文案零 UGX；编辑预填；新旧 uuid 不同且 supersedes 正确；旧记录仍在；最新版本标记为 CURRENT；相同 site code
审查结论：（完工时填）
