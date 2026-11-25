# Web 投票系统

一套功能完整的全栈 Web 投票 / 问卷系统，覆盖投票发布、全题型作答、实时统计、评论点赞、后台管理等核心能力，并实现了设备指纹 / IP 限流 / 验证码触发等完整防作弊链与专业级数据分析导出。

## ✨ 项目亮点

- **全题型支持**：单选、多选（可设最少 / 最多项）、打分、排序、填空、图文，问卷式多题三层数据模型。
- **完整防作弊链**：设备指纹（Canvas 哈希 + UA + 屏幕 + 时区，后端叠加 IP 兜底）、IP 最小间隔与每小时上限、高频触发图形验证码、设备 / IP 双黑名单、全量投票溯源；评论 XSS 过滤、SQL 全部参数化查询。
- **专业数据统计**：实时看板（总票数 / 参与人数 / 浏览量 / 转化率）、占比饼图、票数排行、小时趋势、地域 / 设备 / 高峰时段 / 无效票多维分析，内存缓存 10 秒扛并发，支持明细与统计 Excel 导出。
- **安全与工程化**：JWT 鉴权、bcryptjs 密码哈希、helmet 安全头；后端 Koa2 分层（config / db / middlewares / services / routes），前端 Vue3 + Pinia + Element Plus + ECharts。
- **零依赖一键启动**：数据库采用 sql.js（纯 WASM SQLite），无需安装 MySQL / Redis；架构分层清晰，生产部署可平滑替换为 MySQL + Redis，业务代码无需改动。

## 🧰 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3 + Vite + Element Plus + ECharts + Pinia + Vue Router + Axios |
| 后端 | Node.js + Koa2 + Koa-Router + JWT + bcryptjs + ExcelJS |
| 数据库 | SQLite（sql.js 纯 WASM 实现，开箱即用无需安装数据库） |
| 缓存 | 内存级 LRU 缓存（可平滑替换为 Redis） |
| 安全 | helmet + bcryptjs + 设备指纹 + IP 限流 + 图形验证码 |

## 🏃 快速开始

### 环境要求

- Node.js >= 18（推荐 20+）
- npm >= 8

### 启动步骤

```bash
# 1. 启动后端（默认 3000 端口）
cd server
npm install
npm run dev
# 首次启动自动创建数据库 + 管理员账号 admin/admin123 + 默认模板

# 2. 启动前端（默认 5173 端口，另开终端）
cd web
npm install
npm run dev

# 3. 浏览器访问 http://localhost:5173
```

### 默认账号

- 管理员：`admin` / `admin123`
- 可在登录页注册新账号

## 📁 项目结构

```text
web-voting-system/
├── server/                         # 后端
│   ├── src/
│   │   ├── config.js               # 全局配置（端口/JWT/防作弊规则）
│   │   ├── db.js                   # SQLite 初始化 + 建表 SQL + 种子数据
│   │   ├── app.js                  # Koa 入口（CORS/helmet/路由注册）
│   │   ├── middlewares/
│   │   │   ├── auth.js             # JWT 鉴权（必选/可选/管理员）
│   │   │   └── antiCheat.js        # 防作弊核心（设备指纹/IP限流/验证码/黑名单）
│   │   ├── services/                # 业务服务层（认证/投票/统计/社交/后台/验证码）
│   │   └── routes/                  # 路由层（auth/vote/stats/admin/user/captcha）
│   ├── data/                       # SQLite 数据文件（运行时自动生成，不入库）
│   └── package.json
├── web/                            # 前端
│   ├── src/
│   │   ├── api/index.js             # Axios 封装 + 设备指纹生成
│   │   ├── stores/user.js           # Pinia 用户状态
│   │   ├── router/index.js          # 路由 + 守卫
│   │   └── views/                   # 首页/详情/创建/统计/登录注册/用户中心/后台等
│   ├── vite.config.js              # Vite 配置（含 /api 代理到 3000）
│   └── package.json
└── README.md
```

## 🗄️ 数据库表设计

共 14 张表（建表 SQL 见 `server/src/db.js` 的 `initDatabase()`），核心表包括：

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `users` | 用户 | username / password_hash / role / status / is_blacklist |
| `votes` | 投票主表 | title / vote_type / status / start_time / end_time / max_votes_per_user / result_visible / password |
| `vote_questions` | 题目 | vote_id / question_type / min_select / max_select / min_score / max_score |
| `vote_options` | 选项 | question_id / content / image_url / vote_count / score_sum |
| `vote_records` | 投票记录（全量溯源） | vote_id / option_id / user_id / device_fp / ip / user_agent / is_valid / invalid_reason |
| `device_blacklist` / `ip_blacklist` | 设备 / IP 黑名单 | device_fp / ip / reason |
| `option_comments` / `option_likes` | 评论 / 点赞 | option_id / content / like_count / user_id |
| `vote_templates` | 模板库 | name / category / config(JSON) |

关键索引支撑高并发查询：`idx_records_vote_user`、`idx_records_vote_fp`、`idx_records_vote_ip`、`idx_options_count` 等。

## 🔌 API 概览

通用约定：Base URL `/api`；登录后请求头带 `Authorization: Bearer <JWT>`，前端自动带 `X-Device-FP`；响应格式 `{ code: 0, data: {}, msg: '' }`，code 非 0 为异常。

| 模块 | 代表接口 |
|------|----------|
| 认证 | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/profile` |
| 投票 | `GET /api/votes`（列表筛选）、`GET /api/votes/:id`、`POST /api/votes`、`PUT /api/votes/:id`、`POST /api/votes/:voteId/submit`、`POST /api/votes/:id/duplicate` |
| 统计 | `GET /api/stats/votes/:id`、`GET /api/stats/votes/:id/leaderboard`、`GET /api/stats/votes/:id/export`、`GET /api/stats/votes/:id/export-stats` |
| 验证码 | `GET /api/captcha/json`、`POST /api/captcha/verify` |
| 用户中心 | `GET /api/user/my-votes`、`GET /api/user/participated`、`GET /api/user/favorites`、`PUT /api/user/profile` |
| 后台管理 | `GET /api/admin/users`、`POST /api/admin/votes/:id/action`、`GET /api/admin/dashboard`、`GET/POST /api/admin/blacklist`、`GET/POST /api/admin/templates` |

## 🛡️ 核心防作弊机制

提交投票经过中间件链：`authOptional → deviceFingerprintMiddleware → voteAntiCheatMiddleware → submitVote`。

- **设备指纹**：前端 Canvas 哈希 + UA + 屏幕 + 时区，后端再叠加 IP 前两段兜底（防前端伪造），SHA256 取 32 位。
- **IP 限制**：最小间隔 8 秒 + 每小时上限 40 次（可配）。
- **验证码触发**：同设备每小时超过 5 次自动要求验证码（响应 449 + `needCaptcha:true`）。
- **黑名单**：设备指纹 + IP 双黑名单，DB 持久化 + 内存快速判定。
- **投票溯源**：每票记录 user_id / device_fp / ip / user_agent / created_at，支持全量追溯。
- **注入与 XSS 防护**：全部参数化查询；评论内容过滤 HTML 标签；通用 API 与投票接口专项限流。

## 📊 数据统计能力

- **实时看板**：总票数 / 参与人数 / 浏览量 / 转化率 + 选项占比饼图 + 票数柱状排行 + 小时趋势折线。
- **多维分析**：地域分布（IP 段）、设备类型（UA 解析）、高峰时段 TOP5、无效票分类、填空答案汇总。
- **缓存与导出**：统计结果内存缓存 10 秒；支持明细 Excel（含 IP / 设备 / 用户 / 有效性全字段）与统计结果 Excel 导出；独立公示页 `/vote/:id/stats` 公开全部图表数据。

## 📌 可扩展方向

1. **新增题型**：在 `vote_questions.question_type` 增加枚举，前端详情 / 创建页增加分支即可。
2. **生产数据库替换**：将 `db.js` 的 DBWrapper 换成 better-sqlite3 直连或 Sequelize；内存缓存换成 ioredis，业务代码零改动。
3. **滑块 / 第三方验证码**：替换 `captcha.js`，对接极验 / 腾讯防水墙，token 通过 `X-Captcha-Passed` 头传递。
4. **行为检测算法**：在防作弊中间件增加投票频率模式分析，标记异常票为 `is_valid=0`。

## 📄 License

MIT © 林昱宏
