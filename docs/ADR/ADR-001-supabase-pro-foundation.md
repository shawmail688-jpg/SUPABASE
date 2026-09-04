# ADR-001：Supabase Pro 作为平台承重数据底座

Status：Accepted
Date：2026-09-03
决策者：用户（提案 v1.2 定案「无免费选项」，v1.3 §5 维持）
来源：Proposal v1.3 §5（选型对比表）

# 一、背景（Context）

- 库承载选址调查+店面管理两个系统（未来复用换电站），是承重墙不是实验田；免费档 7 天无活动暂停=两系统同时哑，且无自动备份
- 安全模型（§7 五层）依赖 Auth+RLS+自动备份，底座必须原生提供
- 团队首次云 DB 依赖（Assessment 硬触发 1），选型需留痕可回退

# 二、决策（Decision）

Supabase Pro（$25/月）起步即用；区域 Frankfurt/新加坡择低延迟（开放问题，架构阶段出对比推荐后用户拍板）。Postgres(+PostGIS)+Auth+RLS+Storage+Realtime 一体。

# 三、候选方案与取舍（Alternatives）

| 方案 | 理由 | 否决原因 |
|------|------|----------|
| **Supabase Pro** ✅ | 一体化+无暂停+自动备份+PITR；团队已有认知先例（同事 supabase_schema.sql） | — |
| Supabase 免费档 | ¥0 | 7 天暂停+无备份=承重墙不可接受 |
| 腾讯/阿里云 HK 自建 Postgres | 数据完全自持 | 自运维全自己扛；**保留为合规备选**（总部答复不允许第三方云时启用，标准 Postgres 平迁架构不变） |
| Cloudflare D1+R2 | 边缘便宜 | SQLite 无 PostGIS、并发写弱；保留作前端托管候选 |
| Firebase | 真实时 | 无 PostGIS、锁生态 |
| 维持 Google Sheet | 零改动 | 无鉴权粒度/链接共享裸奔——正是要还的债 |

# 四、验证证据（如经评估 / 原型）

- 选型论证：Proposal v1.0→v1.3 三轮外评处置（附录 A）；无原型（Assessment 已知风险，TECH_DEBT 登记）
- 配额数字不写入设计（附录 A 第二轮 #5：以官方当期为准）

# 五、后果（Consequences）

- 正面：零运维获 Postgres+Auth+RLS+Storage+备份；标准 Postgres+pg_dump 随时可迁出（反锁定）
- 代价 / 技术债：$25/月运营成本；供应商锁定风险（缓解：标准 SQL+每日冷备）
- 回退触发条件：①总部合规答复不允许第三方云 → 平迁自建 HK；②Supabase 服务持续不可用/大幅涨价 → pg_dump 平迁

# 六、变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-03 | 建档（追溯 v1.2 定案） | ADR 归档补课 |
