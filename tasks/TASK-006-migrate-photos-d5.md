# TASK-006：存量照片迁移 D5（migrate_photos.mjs）
状态：TODO（前置：TASK-005；**照片源目录已预锁定 09-04**：`E:\项目\uganda-house-finder\data\survey\photos`（09-15 外审修正：原锁路径 `E:\uganda-house-finder` 不存在，正确路径已实证含照片）——来自 `build_showroom_atlas.py` L66 `PHOTOS_DIR = ROOT / "data" / "survey" / photos`，锁定后不漂移）
目标：本地照片目录 → sha1 去重 → Storage 上传（private 桶，路径 {project_code}/{site_code}/{sha1}.jpg）→ photo 表登记，计数对账闭合
输入：docs/Design/02-Database.md §3.6 photo、§七 Storage、§八 D5；docs/Design/04-Module.md M-Mig；build_showroom_atlas.py 配置（源目录）
验收条件：
1. 任务单开工时锁定源目录路径并记录于本文件（之后不漂移）
2. `migrate_photos.mjs` 幂等：连跑两遍第二遍零新增上传；sha1 已存在跳过
3. 计数对账闭合：本地文件数 ≥ 去重后上传数 = photo 行数（差异=重复 sha1，清单存档）
4. 抽样 N=10：签名 URL 可打开且内容与本地原文件一致（肉眼+文件大小比对）
5. Storage 桶策略实测：anon 直连对象 URL 403（私有）
审查结论：（完工时填）
