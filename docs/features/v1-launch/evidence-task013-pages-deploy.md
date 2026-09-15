# TASK-013 Cloudflare Pages 部署证据

日期：2026-09-15  
方式：Cloudflare Pages Direct Upload API（未安装 Wrangler 或其他软件）

## 部署记录

- 项目：`uganda-house-finder`
- 分支：`feat/m2b-form-retarget`
- 提交：`cff0257`（生产恢复链接处理）
- deployment：`81ead23c-276c-42e0-862e-15051aac7958`（初始部署 `98e69696-8ca8-4c3d-bb88-f9f802d5b4ea`）
- API `latest_stage.status`：`success`
- 生产域名：[uganda-house-finder.pages.dev](https://uganda-house-finder.pages.dev)
- 部署 URL：[81ead23c.uganda-house-finder.pages.dev](https://81ead23c.uganda-house-finder.pages.dev)

## 线上机器验证

```text
/                         HTTP 200
/lib/app.js               HTTP 200（返回 20,772 bytes JavaScript，含恢复密码流程）
/leader.html              HTTP 200
/work.html                HTTP 200
Edge headless #/selftest-full: DASHBOARD FULL SELFTEST 7/7
```

剩余验收：自定义域名 HTTPS、领导手机外网登录/地图/照片/审批、国内可达性、街道/卫星瓦片与故障注入。完成这些用户窗口后，TASK-013 才能置 DONE。
