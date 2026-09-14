# ADR-008：地图瓦片供应与自动降级

Status：Proposed / L2 In Review
Date：2026-09-14
决策者：用户（已授权实施，待架构重新 Lock）
来源：地图瓦片 403 故障与三项目长期稳定要求

## 背景

既有 Atlas 与选址系统前端直接请求 OpenStreetMap 公共标准瓦片。该服务要求网页请求携带有效 Referer，直接打开本地 HTML、部分预览器或代理链会被拒绝并显示 403/Access denied。公共标准瓦片也不是本系统的生产 SLA 服务，不应成为唯一底图。

## 决策

1. 所有前端禁止硬编码 `tile.openstreetmap.org`。
2. 首发默认街道图使用 Esri World Street Map；卫星图使用 Esri World Imagery，并保留正确署名。
3. 所有页面使用同一配置契约：

   ```js
   window.MAP_TILE_CONFIG = {
     streetUrl: ".../{z}/{y}/{x}",
     satelliteUrl: ".../{z}/{y}/{x}",
     errorThreshold: 3
   };
   ```

   默认值可随静态页面交付；Cloudflare Pages 生产环境由 `config.js` 注入。未来采购带 SLA 或域名鉴权的供应商时只替换配置，不改 pin、筛选、卡片等业务代码。
4. 主街道图连续 3 个瓦片失败时，页面无需刷新自动切到卫星图。Atlas 另带坎帕拉离线瓦片缓存，卫星图也失败时继续降级到离线缓存。
5. 发布闸门包含静态扫描与故障注入：产物不得出现 OSM 公共标准瓦片地址；拦截主瓦片后必须观察到备用瓦片实际加载；file://、localhost 与 Pages 自定义域名分别实测。

## 权衡

- Esri 公共服务可立即解决 Referer 型 403，但仍不等于商业 SLA。配置抽象为日后接入 MapTiler、Stadia、Mapbox 或 ArcGIS 带鉴权方案保留无代码迁移路径。
- 街道图和卫星图默认来自同一供应商，因此 Atlas 的本地缓存是最终兜底；Platform 上线前应根据实际网络测试决定是否采购独立供应商作为第二来源。
- 不在客户端仓库保存秘密 API key。采用域名鉴权或仅允许公开的浏览器 token；有权限的 key 由部署环境注入并限制来源域名。

## 影响范围

- `E:\项目\uganda-house-finder`：Atlas 生成器、当前产物、离线缓存构建器和桥接服务。
- `E:\项目\选址系统开发\index.html`：现有选址地图。
- 本仓 TASK-011/012/013：未来 Platform 看板实现与发布验收。
