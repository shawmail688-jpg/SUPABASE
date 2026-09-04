# TASK-017：S5 GAS 通道退役（双写收口）
状态：TODO（前置：TASK-010 连续 7 天零差异报告 + TASK-013 领导实开通过）
目标：Apps Script 旧通道退役冻结（30 天可复活），PG 成为唯一写入通道
输入：docs/PRD/PRD-V1.md §七 S5（Lock 文本）；docs/Design/03-API.md §三退役条件；backfill_sheet.mjs 备件
验收条件：
1. 退役 checklist 执行留痕：表单 target 切 `supabase`；GAS 触发器停用+脚本头注记退役日期（不删文件）
2. backfill_sheet.mjs 备件验证：PG→Sheet 测试目标回灌一次成功（复活路径可用性证据）
3. 冻结清单落实：push_to_sheet.py/sheet_post.py/merge_spm.py 停计划任务+头注记（01 §五 L6①）
4. 退役后一周 daily 对账报告继续跑（防漏网写入），零差异
审查结论：（完工时填）
