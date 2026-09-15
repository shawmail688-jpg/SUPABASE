# 任务单目录（TASK-xxx）

**格式**：每任务一个文件 `TASK-xxx-<slug>.md`，字段固定：

```markdown
# TASK-xxx：<标题>
状态：TODO | DOING | REVIEW | DONE
目标：<一句话>
输入：<涉及的文档节/表/文件>
验收条件：（逐条可自动化，C6）
审查结论：（附尾部，谁审的/结论/日期）
```

**纪律**：验收条件先行再动工；DONE 必须带机器证据（测试输出/自检脚本）或用户验收记录；审查结论随任务单留痕，不另开目录。

## 看板

> 阶段一=M1 建库→M2b 表单换靶（TASK-001~010）；阶段二=M3a 领导视图→M3b 工作视图（TASK-011~015）；运维/退役（TASK-016~018）

| 编号 | 任务 | 状态 |
|------|------|------|
| TASK-001 | Supabase 区域拍板实测（Frankfurt；RTT 步经用户裁量豁免） | DONE |
| TASK-002 | Supabase 项目 + day-1 最小闭环验证（首月 Free，次月 Pro） | DONE（09-14 五项全 PASS，证据 docs/features/v1-launch/day1/） |
| TASK-003 | 建库迁移 SQL（D1 表结构+D2 RLS/触发器/RPC/种子） | DONE（09-14 四项验收全 PASS，证据 evidence-task003/；domain_config 回填移交 TASK-004 前） |
| TASK-004 | D3 SQL 用例全绿（sql_cases.sql） | DONE（09-14 两遍 28/28；domain_config v2 已回填） |
| TASK-005 | 存量数据导入 D4 + 对账 | TODO |
| TASK-006 | 存量照片迁移 D5 | TODO |
| TASK-007 | 照片压缩参数定档（开放问题 #7） | TODO |
| TASK-008 | 表单换靶 M2b（adapter+auth+离线队列） | TODO |
| TASK-009 | 表单 E2E 自检 | TODO |
| TASK-010 | 双写对账脚本（S4 闸门材料） | TODO |
| TASK-011 | 看板骨架移植+登录墙 | IN REVIEW（骨架/登录墙/角色分流/真实 Leaflet 地图已接入；selftest 12/12） |
| TASK-012 | 领导视图+Realtime | IN REVIEW（Storefront Atlas 默认旧版 OSM Standard、Esri 双备用与大画布，已接真实坐标、去重照片灯箱与风水卡；hidden 隐藏、archived 保留） |
| TASK-013 | Cloudflare Pages 部署+域名+领导实开【域名】 | IN REVIEW（自定义域名与单链接三角色已上线；待真实账户手机实开） |
| TASK-014 | 工作视图（编辑/时间线/恢复/CSV） | TODO |
| TASK-015 | 看板 selftest 全量+N5 视觉走查 | IN REVIEW（core 11/11、full 8/8；本地桌面视觉走查通过） |
| TASK-016 | 冷备计划任务+恢复演练 | TODO |
| TASK-017 | S5 GAS 通道退役 | TODO |
| TASK-018 | S6 atlas_bridge 退役+Feature 收尾 | TODO |

## 依赖链

```text
001 → 002 → 003 → 004 → 005 → 006
              │      └── 011 ──→ 012 → 013 → 017 → 018
              │      └── 014 ──────────────────┘│
              │             015（012+014 后）────┘
              └── 008 → 009 → 010 → 017
002 → 007（并行）；002 → 016（并行）
```
