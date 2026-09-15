# ADR-008：地图瓦片供应与自动降级

Status：Proposed / L2 In Review
Date：2026-09-14
决策者：用户（已授权实施，待架构重新 Lock）
来源：地图瓦片 403 故障与三项目长期稳定要求

## 背景

既有 Atlas 使用 OpenStreetMap 公共标准瓦片。该服务要求网页请求携带有效 Referer，直接打开本地 HTML、部分预览器或代理链会被拒绝并显示 403/Access denied。公共标准瓦片也不是本系统的生产 SLA 服务，不应成为唯一底图。2026-09-15 用户确认：原 Atlas 中被排除的 OSM 标准底图正是希望恢复的默认视觉。

## 决策

1. 生产看板恢复官方 OpenStreetMap Standard 作为默认底图，使用精确地址 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，显示 `© OpenStreetMap contributors`，并由页面以 `strict-origin-when-cross-origin` 发送有效 Referer。
2. Esri World Street Map 作为第一故障备用，Esri World Imagery 作为第二备用；三层底图均保留正确署名和手动切换入口。
3. 所有页面使用同一配置契约：

   ```js
     window.MAP_TILE_CONFIG = {
     osmUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
     streetUrl: ".../{z}/{y}/{x}",
     satelliteUrl: ".../{z}/{y}/{x}",
     defaultMode: "osm",
     errorThreshold: 3
   };
   ```

   默认值可随静态页面交付；Cloudflare Pages 生产环境由 `config.js` 注入。未来采购带 SLA 或域名鉴权的供应商时只替换配置，不改 pin、筛选、卡片等业务代码。
4. OSM 连续 3 个瓦片失败时，页面无需刷新自动切到 Esri 街道图；Esri 街道图连续失败再切卫星图。用户仍可手动切换三种底图。
5. OSM 只用于普通的人机交互浏览：禁止批量下载、预抓、离线缓存和代理转发。发布闸门核验精确 URL、可见署名、有效 Referer 与故障注入；Pages 自定义域名必须实测。

## 权衡

- OSM Standard 符合用户确认的视觉，但没有 SLA，服务方可在策略或容量原因下阻断；双 Esri 备用避免单一来源让地图空白。
- 配置抽象为日后接入 MapTiler、Stadia、Mapbox 或 ArcGIS 带鉴权方案保留无代码迁移路径。
- 不在客户端仓库保存秘密 API key。采用域名鉴权或仅允许公开的浏览器 token；有权限的 key 由部署环境注入并限制来源域名。

## 影响范围

- `E:\项目\uganda-house-finder`：Atlas 生成器、当前产物、离线缓存构建器和桥接服务。
- `E:\项目\选址系统开发\index.html`：现有选址地图。
- 本仓 TASK-011/012/013：未来 Platform 看板实现与发布验收。
