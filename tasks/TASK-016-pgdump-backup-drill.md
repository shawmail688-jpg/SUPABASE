# TASK-016：冷备计划任务 + 恢复演练（M-Ops）
状态：TODO（前置：TASK-002；独立可并行）
目标：办公室机器每日 pg_dump 计划任务 + restore_drill.ps1 恢复演练，runbook 成文（办公室机器=可丢层，备份可重建）
输入：docs/Design/01-Architecture.md §二三层可用性；docs/Design/04-Module.md M-Mig（pg_dump_backup.ps1）
验收条件：
1. pg_dump_backup.ps1 计划任务注册（每日），连续 3 日产出 dump 文件（任务计划器历史留痕）
2. restore_drill.ps1：dump→临时库恢复→行数对拍（site/survey_result/photo 三表 count 一致）全绿
3. runbook 成文：dump 位置/保留策略/恢复步骤/负责人（仅 secret key 走 .env，不入 git）
审查结论：（完工时填）
