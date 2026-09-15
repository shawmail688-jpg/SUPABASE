# TASK-012 / TASK-014 — dashboard continuation evidence

日期：2026-09-15

## 已落地

- 领导视图现在按同一 `latestSurvey(site)` 契约展示四态计数、最新租金、坐标缺失提示、地图 pin、详情入口、Survey 历史和状态时间线。
- manager/admin 操作按钮调用 `approve_site`、`hide_site`、`restore_site` RPC；`hide_site` 写入 `hidden`，archived 仍可见；surveyor 只看到 field-form 入口。
- 工作视图支持地址与经纬度编辑（空值经 API 发送 `null`）、保存到 `site`，以及带 UTF-8 BOM 的 CSV 导出。
- 详情照片采用 lazy 签名 URL 请求；签发失败不会阻断其它详情内容。

## 本地证据

- Edge headless `#/selftest`: `DASHBOARD SELFTEST 7/7`。
- Edge headless `#/selftest-full`: `DASHBOARD FULL SELFTEST 7/7`（manager/surveyor/admin 操作矩阵、archived 地图可见、历史保留、编辑字段、CSV 表头）。
- 1440px 截图目验：汇总条、地图、最新备注、操作表格在同一屏级联；暖纸色/teal/orange tokens 生效。
- `node --check`：`web/dashboard/lib/api.js`、`app.js`、`map.js`、`config.js` 全部通过。

## 尚待真实环境

- Realtime channel 的 ≤3s 实测、签名 URL 过期后的 `img onerror` 重签、管理员 archived 列表和真实 RPC 越权断言，留 TASK-012/015 的 Supabase 账号窗口执行。
