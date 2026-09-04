# TASK-014：工作视图 work.html（M3b：表格/编辑/时间线/恢复/CSV）
状态：TODO（前置：TASK-011）
目标：桌面工作视图：店面表格（名称/区域/状态/最近更新/调查次数）+详情字段全量编辑+调查时间线+归档恢复入口（仅 admin）+CSV 导出
输入：PRD R15/§4.1（两视图同库互映）；docs/Design/03-API.md §2.3/§2.5；docs/Design/02-Database.md §6.1③（COALESCE 闸：文本列清空发空串、lat/lon 显式 null）
验收条件：
1. 表格列与排序/筛选可用；行数=DB 非 archived 计数（对拍）
2. 编辑保存：基础字段 UPDATE 成功且 updated_at 变化；清空文本字段发空串生效；lat/lon 清空（null）生效；status 列不在编辑面（GUC 闸兜底）
3. 时间线：site_status_log 按 at.desc 全显（谁在何时批/藏）
4. 恢复入口仅 admin 可见可操作；manager 不可见且 RPC 拒（DOM+RPC 双层断言）
5. CSV 导出：行数=DB 计数、表头/编码（UTF-8 BOM）断言
6. 工作视图编辑后 leader 视图刷新可见（两视图同库互映——用户确认口径）
审查结论：（完工时填）
