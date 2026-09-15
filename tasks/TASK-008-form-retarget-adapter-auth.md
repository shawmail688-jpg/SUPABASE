# TASK-008：表单换靶 M2b（upload-adapter 双实现 + auth + 离线队列）
状态：TODO（前置：TASK-004；分支开发，PR 后合）
目标：既有单文件表单内建 upload-adapter：adapter-appscript（原逻辑封装）/adapter-supabase（03 §2.2 三步契约）/selector 配置切换；auth 模块（登录+会话持久化+401 入队）；离线队列带 target 标记重放。CR-004 允许租金币种与历史修订交互变更
输入：docs/Design/03-API.md §2.1/§2.2（三步契约/幂等/R3 隐藏店防呆）；docs/Design/04-Module.md M-Form；docs/Design/01-Architecture.md §四 4.1/4.2
验收条件：
1. `target:'appscript'` 模式回归：与现网行为一致（对既有测试/自检零回归）
2. `target:'supabase'` 模式：三步契约 E2E 成功；uuid 预生成；409/主键冲突=成功路径断言；created_by 落 auth.uid()
3. R3 防呆：archived code 提交→提示「该店已隐藏，联系管理员恢复」，不发 upsert
4. 断网提交→入队；回网自动 flush 顺序重放；重复重放零重复行（uuid 断言）；未登录/401 入队不发送
5. `target:'dual'`：双发成功且两通道各一条；单侧失败入各自队列
6. 源码走分支→PR→审后合（git 纪律）
7. 租金输入/展示为 USD/month；历史 L/V 记录可预填编辑并以新 uuid 重发，`supersedes` 指向旧 uuid，旧记录保留；同店稳定 site code 不因字段修改漂移
审查结论：（完工时填）
