# Codex 外审请求：D1/D2 迁移落库 + D3 用例执行（TASK-002/003/004）

> 致：Codex（设计闸门外审）。背景：survey-platform M1 数据层已在真实 Supabase 项目（Frankfurt free 档）落地并全绿，你此前两轮评审（8.5/10 那轮 + 15 条 PRD 评审）的意见均已处置。本次请你**外审实测后的落地代码与两处现场修复**。无仓库访问权，材料自足如下。
> 回复格式：逐条 `采纳 / 驳回` + 一句理由 + 指向具体证据点。你只有评审权，无决策权（用户终裁）。

## 一、执行摘要（机器证据均在库 `docs/features/v1-launch/`）

| 项 | 结果 | 证据 |
|----|------|------|
| day-1 五项（RLS/签名URL/直传/Realtime/CORS） | 5/5 PASS | day1/ 日志 9 件 |
| 迁移 0001+0002 双遍重放 | 第二遍零报错 | evidence-task003/migrate.log |
| geog 生成列 | IMMUTABLE 建成，未降级 | asserts.json |
| 断言 12/12（10表/RLS×10/索引6/触发器12/函数8/REVOKE DELETE/种子3） | 全 PASS | asserts.json |
| 回滚演练 | 回滚→0表→重放→复验 12/12 | rollback.log |
| D3 用例两遍 | **28/28 全绿 ×2**（同库重跑） | evidence-task004/d3_run1/run2.log |

## 二、两处现场修复（重点评审对象）

### 修复 1：`site_status_log.site_id` FK 改 deferrable initially deferred
**现场**：D3 fixtures 首次插入 site 即炸——`site_before_change()` 是 BEFORE INSERT 触发器，触发器内部向 site_status_log 写首条 submit log，而 site 行彼时尚未落表 → FK 即时检查必炸（任何 site insert 都失败，非测试特有）。
**修复**：0001 中该 FK 加 `deferrable initially deferred`（检查推迟到 commit）。
**请评**：①软删除/owner 语义是否被削弱；②deferrable 窗口内触发器写日志失败时的原子性（应整体回滚——是否成立）；③有没有更正统的替代（AFTER 触发器 + 语句级回滚？为何弃用：BEFORE 还承担状态门禁与 COALESCE 补列，拆分成本高）。

### 修复 2：`pg_temp.record()` 加 security definer
**现场**：D3 判分函数为 invoker 权限，`pg_temp.become()` 切到 authenticated 后 record 写判分表被拒（permission denied）。
**修复**：判分函数加 `security definer`（属主=迁移超级用户）。
**请评**：①definer 放大面评估（仅写会话私有 temp 表，是否可接受）；②同类 harness 函数（become/clear/guc）是否也该 definer 还是保持 invoker。

## 三、迁移幂等化改造（验收 1「两遍重放」实测驱动）
原稿裸 `create type/table/index/trigger/policy` 二遍必炸。改造：type→DO duplicate_object 兜底；table/index→if not exists；trigger/policy→前插 `drop ... if exists`。全文见附文件 `0001_d1_schema.sql`（152 行）/`0002_d2_rls_functions_rpcs.sql`（361 行）。
**请评**：①护栏盲区（我们未护：extension/枚举值追加/publication——v1 迁移不含后两者，对吗）；②`drop policy if exists + create policy` 在生产重放时是否有瞬时权限空窗（执行期业务在线场景）。

## 四、domain_config v2（配置驱动第一份真实配置）
从在用离线表单 `survey_form.html` 机械提取，v2 追加入库（v1 占位留档）。结构：survey(lead) 14 字段 / verify 8 字段 / groups A-B-C / P1-P4 实景拍照指引 / rent=UGX月+refused 拒答旗标。全文见对话所附 JSON（或库内 domain_config 表 version=2 行）。
**请评**：①与「换配置=换系统」目标的距离——字段结构还缺哪些元数据（校验规则/必填条件/离线 idempotency 约束）；②lease「required」在服务端的落点（现在只有前端 required，DB 层 rent/space 可空——设计如此，是否同意）。

## 五、D3 覆盖盲区自查（请补充）
已覆盖：三角色矩阵/状态机合法+非法/GUC 闸/越权拒/首条 log+audit/跨项目隔离/匿名零/COALESCE 闸/空串清空/svc_migration 旁路。
自查未覆盖：①并发审批同一点（两 manager 同时 approve）②photos sha1 唯一冲突路径 ③domain_config 并发版本 ④Realtime 在 RLS 下的收件边界（day-1 只证了通）⑤geog 邻近查询性能（无数据量）。请按风险排序补充你认为必须进 TASK-005 前的项。

## 六、材料清单
- `0001_d1_schema.sql` / `0002_d2_rls_functions_rpcs.sql`（幂等化后全文）
- `sql_cases_api.sql`（D3 适配版全文：剥离 psql 元命令、rollback 提至批尾）
- domain_config v2 JSON（评审正文第四节摘要 + 库内可查）
