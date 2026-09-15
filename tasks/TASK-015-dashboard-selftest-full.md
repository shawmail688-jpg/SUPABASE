# TASK-015：看板 selftest 全量 + N5 视觉走查（M3b 验收）
状态：IN REVIEW（2026-09-15：core selftest 8/8、full selftest 8/8，真实地图桌面视觉走查通过）
目标：三角色×操作矩阵 selftest 全绿 + N5 视觉质量走查（用户标准：超出 Atlas T22 水准）
输入：docs/Design/04-Module.md M-Dash 关键设计/测试要点；PRD §4.4 权限矩阵；N5
验收条件：
1. selftest 矩阵全绿 dump 证据：三角色×(看板入口/批准/隐藏/编辑/恢复/导出) 可见性与可操作性（DOM+RPC 双层）
2. 批准闭环/恢复闭环/CSV 行数/375px 各用例机器断言
3. N5 走查清单过：tokens 统一（无裸色值）、四态状态色一致、间距/字号符合 tokens.css、空态/加载态/错误态三态齐——走查记录附任务单
4. 用户视觉验收（截图对照 Atlas T22，用户一句话确认）
审查结论：本地 Review PASS。manager/surveyor/admin 的按钮矩阵、历史保留、编辑字段和 CSV 契约均有自测；新增断言覆盖无坐标文案、Leaflet 地图模块及 hidden 店面不进入 Atlas。真实地图已完成本地桌面走查，列表定位、popup、Google Maps 外链与图层切换正常。真实 RPC 越权、Realtime ≤3s、375px 全量及用户视觉确认待 TASK-013 账号窗口。
