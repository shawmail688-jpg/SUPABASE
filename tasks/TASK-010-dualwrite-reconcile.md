# TASK-010：双写对账脚本（reconcile_dualwrite.mjs，S4 退役闸门材料）
状态：TODO（前置：TASK-009；S4 双写期每日跑）
目标：03 §三口径落地：PG（source='form' ∧ added_date≥S4 起始日）↔ Sheet 同窗口行，列映射 building↔name 等 B..J；pin 链接行跳坐标比；零差异连续 7 天→触发退役 checklist
输入：docs/Design/03-API.md §三（R1 修正后口径）；docs/Design/04-Module.md M-Mig；survey_writeback.gs（Sheet 列）
验收条件：
1. 脚本输出对账报告（日期/窗口行数/逐列差异清单/结论行）存档 `scripts/reports/`
2. 负向用例：人为制造单侧差异→报告点名该行该列
3. 链接 pin 行：跳过坐标比、其余列照比（用例覆盖）
4. 连续 7 天零差异判定逻辑有单元用例（含中断重置场景）
审查结论：（完工时填）
