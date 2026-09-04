# TASK-018：S6 atlas_bridge 退役 + Feature 收尾
状态：TODO（前置：TASK-015 + TASK-017）
目标：atlas_bridge 退役（主线仓恢复静态只读），v1-launch 全量验收收尾（Scope 验收标准逐条勾稽）
输入：docs/PRD/PRD-V1.md §七 S6；docs/features/v1-launch/Scope.md 验收标准；SE Workflow Feature 收尾协议
验收条件：
1. atlas_bridge 停计划任务+头注记退役日期；serve_atlas.py/build_showroom_atlas.py 同步冻结注记；原 Atlas 页保留只读
2. Scope.md 验收标准逐条勾稽：M1-M3b 各条命令/断言输出齐（C6）
3. DoD 三方一致检查：TODO ↔ PROJECT_CONTEXT ↔ Roadmap（C7）；技术债清单复核（C4）
4. 积累库回流：新工具→D:\tools、踩坑→D:\knowledge\errors、方法论→entries（全局 CLAUDE.md 回流自查）
5. 发布说明+git tag（审后合主线）
审查结论：（完工时填）
