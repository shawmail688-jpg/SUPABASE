# survey-platform — 选址调查数据平台

给乌干达分部十几人用的**小型店面数据系统**：调查照片上云多端调阅、四态审批状态机、领导手机看板；产出（表结构/Auth/RLS/Storage）供选址系统与换电站复用。**权威方案 `docs/SurveyPlatform-Proposal-v1.3.md`（已批准，改架构前必读）**。

## 技术栈

- 底座：Supabase（Postgres+PostGIS / Auth / RLS / Storage / Edge Functions），区域 Frankfurt（TASK-001 已拍板）；09-04 起**首月免费档验证、次月起 Pro**（费用明细 QSP-2026-001）
- 前端：复用 `E:\uganda-house-finder` 的调查表单（离线+压缩直传）与 Atlas 看板骨架
- Google Sheets = **历史数据存档**（迁移后冻结），不是工作台、不是第二事实源

## 核心原则（违反即返工）

1. **DB 唯一权威**；Sheets 只读存档
2. **软删除**：数据库永不物理 DELETE；「隐藏」=否决，仅 admin 可恢复
3. **四态状态机**：调查中→候选→已选→归档（在营 operating 预留不启用）；调查员提交即调查中，候选/已选只能由管理层批准产生；状态变更全走 `site_status_log`
4. **两类角色**：管理层（用户+领导同权：查/改/批/藏/恢复/导出）vs 调查员（仅 INSERT/UPDATE 自己的数据，不可删、不可改 status）
5. **凭证纪律**：secret key、厂商 appKey/secret、总部凭证只进服务端（Edge Function），永不进前端、**永不入 git**
6. **离线灵魂**：调查员野外离线可用是表单硬约束，任何改动不得砍
7. **范围锁**：监控嵌入（M5）与总部 API=后续项目，方案备好未启动（v1.3 §4.2/§11.2）；device 表随 M5

## 文档索引

| 文件 | 内容 |
|------|------|
| `docs/SurveyPlatform-Proposal-v1.3.md` | 权威方案：架构/数据模型/状态机/看板设计/报价（附录 A=三轮评审处置留痕） |
| `docs/Assessment.md` | Step 0 复杂度评估：**Large**（12/18+硬触发 2），四道 L2 闸门 |
| `tasks/` | 任务单目录，TASK-xxx 格式见 tasks/README.md |

## 协作纪律

- 流程：Large（`E:\software-engineering-workflow\workflows\large.md`）；PRD/架构/测试/发布四道 L2 闸门
- git：编码走分支→PR→审查通过才合 main；验收条件先行、逐条可自动化
- 三人组：Claude=任务单+审查+硬骨头 / 牛来窗口=批量编码 / ChatGPT=设计闸门外审 / 用户=验收拍板
- 沟通中文；代码/注释/commit 英文

## 相关资产

- `E:\uganda-house-finder` — 调查管线 v1.1+Atlas 骨架来源；atlas_bridge 救急桥在役至 M3a 上线
- `E:\调查问卷\.sew\survey-engine` — survey-engine v0.3 设计库（配置驱动复现的图纸）
