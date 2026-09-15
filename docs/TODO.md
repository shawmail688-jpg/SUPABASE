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
- [x] CR-001 凭证切新式 key（09-14 批准 Lock，#6；31 处文档同步 + .env.example 建档）+ CR-002 地图瓦片韧性（09-14 批准 Lock，#7，ADR-008）
- [x] TASK-002 Supabase 项目+day-1 验证（09-14 **DONE 五项全 PASS**：Region=eu-central-1 实证、RLS anon 零/401、签名 URL 过期 400、浏览器直传 200、Realtime INSERT 3.9s、file:// CORS 200；证据 docs/features/v1-launch/day1/；测试残留已清理）
- [x] TASK-003 建库 SQL（09-14 **DONE 四项全 PASS**：两遍幂等重放、geog IMMUTABLE、断言 12/12、回滚演练；证据 evidence-task003/）
- [x] TASK-004 D3 用例（09-14 **DONE 两遍 28/28**：d3_run1/run2.log；domain_config v2 已回填，用户复核待补——追加制可 v3 修订）

## 进行中 / 下一步

- [x] TASK-005 存量导入 D4+对账（09-15 **DONE 六组证据全齐**：7 site/6 fengshui/5 SR 单事务导入，幂等重放零新增，回滚重跑 rows_match:true；05abc57）
- [x] TASK-006 照片上云挂载（09-15 **DONE**：45 张两遍幂等，per-site 5/8/6/4/18/4 与源一致；管线复用为活水通道）
- [x] 谷歌表格 8 行隐藏（09-15 完成：浏览器直接在 A2:A9 标 HIDDEN，无代码方案，gviz 验证 8/8；GAS v2.7 动作留档备用）
- [x] 雷蒙照片挂载——Silent Night 已挂（09-15：Gmail API 抓取→目验→入库）
- [x] **Aga Khan Hospital Space 已入库**（09-15：第 8 家候选；邮件来源、Survey 占位版本、照片及关联均已保存；未发现该店自己的地图 pin，坐标保持待补，未借用 Silent Night 坐标）
- [x] TASK-007 压缩定档（09-15：24 张真实样本；默认 1800px/q0.80/1MB，细节 2400px/q0.90/2.5MB；两档体积及目验全 PASS）
- [ ] TASK-008 表单换靶 M2b（IN REVIEW：照片压缩/直传、target 队列、401、archived RPC、dual 状态已实现；selftest 44/44、selftest2 33/33）
- [ ] TASK-009 表单 E2E（IN REVIEW：本地 44/44 + 33/33；真实账号回归待测试密码轮换后执行）
- [ ] TASK-010 双写对账
- [ ] TASK-011 看板骨架+登录墙（IN REVIEW：文件骨架、Auth/角色分流、latestSurvey、瓦片配置已实现；Dashboard selftest 7/7）
- [ ] TASK-012 领导视图+Realtime
- [ ] TASK-013 Pages 部署+域名+实开（**用户动作：域名**）
- [ ] TASK-014 工作视图
- [ ] TASK-015 selftest 全量+N5 走查
- [ ] TASK-016 冷备+演练（并行）
- [ ] TASK-017 S5 GAS 退役
- [ ] TASK-018 S6 退役+收尾

## 用户侧外部待办（非本仓任务）

- [x] 域名配置（2026-09-14 用户同步）
- [x] Supabase 账号注册（2026-09-14 用户同步）
- [x] Supabase 部门 Organization（2026-09-14 控制台实证，Free）
- [x] `survey-platform` Project（Ref=`jfggeudssomocwcnpawk`；2026-09-14 DNS/HTTP 只读核验通过）
- [ ] Region=Frankfurt、2FA 与备份管理员状态确认
- [ ] 次月起 Pro 订阅付款 $25/月（TASK-002，09-04 修订：首月免费）
- [ ] 备份管理员人选打招呼（runbook §0：组织第二管理员 + dept@ 转发第二收件人）
- [x] 费用明细上报领导（2026-09-14 用户确认）；IT 监控盘点四问（提案阶段遗留）
- [ ] Codex 外审 D1-D3 处置：四必修中 FK/record/防御断言已闭环；CR-003 待决策；domain_config v2 复核待补；依赖审批待用户

> 域名已并入部门身份三件套（09-09 定案路径 A），并于 09-14 由用户确认配置完成；TASK-013 直接沿用。
