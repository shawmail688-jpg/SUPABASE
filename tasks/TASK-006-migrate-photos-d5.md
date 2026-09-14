# TASK-006：存量照片迁移 D5（migrate_photos.mjs）
状态：DONE（2026-09-15：45 张存量照片上云 Storage 私有桶 + photo 表挂载，两遍幂等零新增，per-site 计数与源一致 5/8/6/4/18/4；管线 scripts/migrate_photos.mjs 复用为雷蒙新照片活水通道——邮箱路由待用户选定 A 网页半自动 / B IMAP 全自动；谷歌表格 8 行隐藏已用无代码方案完成（A2:A9 标 HIDDEN，gviz 验证 8/8，GAS v2.7 动作留档备用）；雷蒙新照片活水首例已挂载（Silent Night），Aga Khan 新地点待用户决策）
目标：本地照片目录 → sha1 去重 → Storage 上传（private 桶，路径 {project_code}/{site_code}/{sha1}.jpg）→ photo 表登记，计数对账闭合
输入：docs/Design/02-Database.md §3.6 photo、§七 Storage、§八 D5；docs/Design/04-Module.md M-Mig；build_showroom_atlas.py 配置（源目录）
验收条件：
1. 任务单开工时锁定源目录路径并记录于本文件（之后不漂移）
2. `migrate_photos.mjs` 幂等：连跑两遍第二遍零新增上传；sha1 已存在跳过
3. 计数对账闭合：本地文件数 ≥ 去重后上传数 = photo 行数（差异=重复 sha1，清单存档）
4. 抽样 N=10：签名 URL 可打开且内容与本地原文件一致（肉眼+文件大小比对）
5. Storage 桶策略实测：anon 直连对象 URL 403（私有）
审查结论：（完工时填）
