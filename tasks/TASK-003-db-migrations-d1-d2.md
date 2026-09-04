# TASK-003：建库迁移 SQL（D1 表结构 + D2 RLS/触发器/RPC/种子）
状态：TODO（前置：TASK-002）
目标：`supabase/migrations/NNN_*.sql` 纯 SQL 落地 02-Database 全部对象：D1 枚举+10 表+索引+geog 生成列；D2 REVOKE DELETE+RLS 矩阵+辅助函数+触发器（definer 钉 search_path）+RPC 三支+种子数据（project/domain_config/app_user+svc_migration）
输入：docs/Design/02-Database.md §一/§二/§三/§五/§六/§八 D1-D2（Lock v1.2）
验收条件：
1. 迁移文件按序重放成功两遍（第二遍幂等零报错）——psql 或 supabase db push 输出留痕
2. geog 生成列建成（IMMUTABLE 验证；被拒则降级触发器维护列，决策记 ADR-001 变更记录）
3. information_schema 断言：10 表/索引/触发器/RPC 函数齐全；REVOKE DELETE 生效（has_table_privilege 查询输出）
4. 回滚脚本可执行（drop 顺序=依赖逆序）
审查结论：（完工时填）
