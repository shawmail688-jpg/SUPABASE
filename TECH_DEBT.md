# 技术债登记（Tech Debt Registry）

> 技术债单一登记处（C4）。状态：open / planned / accepted / resolved / triggered；严重度：blocker / major / minor

Last Update：2026-09-14

---

# 一、登记表

| 编号 | 描述 | 来源 | 影响 | 严重度 | 计划处理版本 | 状态 |
|------|------|------|------|--------|--------------|------|
| TD-001 | Supabase 选型已论证但**无原型验证**——团队首个云 DB 依赖，RLS/Storage/迁移实操坑未知 | ADR-001 §四；Assessment 硬触发 1 | M1 期可能踩坑返工 | major | M1 | **resolved**（09-14 TASK-002 day-1 五项全 PASS，证据 docs/features/v1-launch/day1/，踩坑 4 条留档） |
| TD-002 | 照片压缩参数（1600-2000px/80%）为行业经验值非实测（Theoretical） | ADR-004 §四 | 细节照可能细节丢失 | minor | M2a（样本断言+用户实拍复核） | open |
| TD-003 | 监控开放平台月费（¥3-10/路/月）与国际区可用性未核实 | ADR-006 §四 | M5 立项估价不准 | minor | M5 立项前置 | accepted（后续项目） |
| TD-004 | cloudflared 快速隧道 URL 每次重启必变（救急桥现状） | D 盘记忆 headless/atlas_bridge；Proposal §10 | 收藏夹失效，领导访问不稳 | minor | M3a（域名+命名隧道） | planned |
| TD-005 | 办公室机器宕机则每日 pg_dump 冷备停跑（单点） | Proposal §14 | 冷备断档（云上数据不受影响） | minor | M1（计划任务+恢复即补跑 runbook） | open |

# 二、回退触发条件（Rollback Triggers）

| 编号 | 关联决策/债 | 触发现象（客观可判） | 处置路径 |
|------|-------------|----------------------|----------|
| RT-001 | ADR-001 / Supabase 底座 | 总部合规答复「不允许第三方云」 | 平迁自建 HK（标准 Postgres+pg_dump，架构不变），走 C2+ADR-001 变更记录 |
| RT-002 | TD-002 / 压缩参数 | 用户实拍复核发现细节照不可辨 | 细节照档参数上调或默认高质量，ADR-004 变更记录 |
| RT-003 | ADR-002 / 四态状态机 | 管理层真实需要新状态（如复核中） | C2 加态，语义不变，ADR-002 变更记录 |

# 三、趋势记录（每 Feature 收尾追加一行）

| 日期 | Feature | 新增 | 解决 | open 总数 |
|------|---------|------|------|-----------|
| 2026-09-03 | v1-launch（文档链阶段） | 5 | 0 | 5 |
| 2026-09-14 | v1-launch TASK-002 day-1 | 0 | 1（TD-001） | 4 |

# 四、维护规则

- 禁止：只记在代码注释里 / 双份维护 / 技术债列表进 PROJECT_CONTEXT
- 评估文档里的「已知限制」迁入本文件，源文档保留指针
