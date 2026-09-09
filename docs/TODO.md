# TODO（当前勾选清单）

> 与 tasks/README.md 看板同源镜像（C7 三方一致对象之一）。勾选条件=DONE 带机器证据。

## 已完成

- [x] M0 立项（13f692d）
- [x] ②Requirement v1.2 / ③Scope v1.0（L1）
- [x] ④PRD-V1 v1.1（L2 Lock，评审 15 条全处置）
- [x] ⑤ADR-001~007 归档
- [x] ⑥架构四件 v1.2（L2 Lock，两轮评审闭环：FAIL→修订→PASS-with-comments→R1-R8 全修复）
- [x] ⑦任务规划 TASK-001~018（L1）
- [x] TASK-001 区域拍板（09-04 用户直接拍板 Frankfurt，RTT 步经用户裁量豁免；1e1a623 含 D1/D2 迁移 SQL 预编写）

## 进行中 / 下一步

- [ ] TASK-002 Supabase 开户+day-1 验证（**用户动作：执行部门身份三件套 runbook**——docs/features/v1-launch/runbook-dept-identity.md；09-04 修订：首月免费验证，次月起 Pro $25/月）

## 待办队列（依赖序）

- [ ] TASK-003 建库 SQL（D1+D2）
- [ ] TASK-004 D3 用例全绿
- [ ] TASK-005 存量导入 D4+对账
- [ ] TASK-006 照片迁移 D5
- [ ] TASK-007 压缩定档（并行）
- [ ] TASK-008 表单换靶 M2b
- [ ] TASK-009 表单 E2E
- [ ] TASK-010 双写对账
- [ ] TASK-011 看板骨架+登录墙
- [ ] TASK-012 领导视图+Realtime
- [ ] TASK-013 Pages 部署+域名+实开（**用户动作：域名**）
- [ ] TASK-014 工作视图
- [ ] TASK-015 selftest 全量+N5 走查
- [ ] TASK-016 冷备+演练（并行）
- [ ] TASK-017 S5 GAS 退役
- [ ] TASK-018 S6 退役+收尾

## 用户侧外部待办（非本仓任务）

- [ ] 部门身份三件套执行（买域名→Cloudflare 转发→Supabase 开户；runbook：docs/features/v1-launch/runbook-dept-identity.md，TASK-002 前置，当前唯一阻塞）
- [ ] 次月起 Pro 订阅付款 $25/月（TASK-002，09-04 修订：首月免费）
- [ ] 备份管理员人选打招呼（runbook §0：组织第二管理员 + dept@ 转发第二收件人）
- [ ] 费用明细上报领导；IT 监控盘点四问（提案阶段遗留，与本仓无依赖）

> 域名已并入部门身份三件套（09-09 定案路径 A），TASK-002 阶段购买，TASK-013 直接沿用。
