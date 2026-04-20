# Hot Pulse 实施方案

## 总览
项目采用单仓结构，分为 `web`、`worker`、`core` 三个逻辑层：
- `web`：Next.js App Router 页面与 API Route Handlers
- `worker`：定时扫描、抓取、分析、打分、通知
- `core`：数据库模型、来源适配器、AI 分析、通知、评分与编排逻辑

## 技术选型
- Web：Next.js + React + TypeScript
- 样式：Tailwind CSS + CSS variables design tokens
- 数据库：SQLite + Drizzle ORM
- 定时任务：Node worker + node-cron
- AI：OpenRouter
- 邮件：Nodemailer
- 测试：Vitest

## 开发阶段
### 阶段 1. 文档与初始化
- 沉淀需求文档、实施方案和技术决策文档
- 初始化 Git、pnpm、Next.js、Tailwind、TypeScript、Drizzle

### 阶段 2. 核心域模型
- 设计监控规则、来源配置、候选内容、热点、证据、通知、扫描运行记录
- 建立 Drizzle schema 和基础数据访问层

### 阶段 3. 多源采集
- 实现网页搜索适配器、Google News RSS、Twitter API、Hacker News、Reddit、GitHub Releases、Custom RSS
- 增加基础频率限制、失败重试和统一内容规范化

### 阶段 4. AI 分析与打分
- OpenRouter 结构化输出
- 热点聚合、去重、来源交叉验证、通知等级计算

### 阶段 5. Web 交互层
- 首页 Radar Desk 布局
- 监控规则管理
- 来源配置与状态
- 热点流与详情抽屉
- 运行状态与通知历史

### 阶段 6. Worker 与验证
- 30 分钟周期任务
- 手动触发扫描
- 测试、构建、冒烟验证

## 默认实现决策
- 检查频率默认 `30 分钟`
- 单用户 MVP，不做登录
- 本地 SQLite 文件存储
- 单一来源弱信号只入库，不触发高优先级通知
- X 数据接入优先使用 `twitterapi.io`

## API 设计
- `POST /api/monitors`
- `PATCH /api/monitors/:id`
- `GET /api/hotspots`
- `POST /api/scan/run`
- `GET /api/sources`
- `PATCH /api/sources/:id`
- `GET /api/notifications`
- `POST /api/notifications/test`

## 验收重点
- 创建规则后可手动扫描出热点
- 热点卡片可看到 AI 摘要和来源证据
- 来源启停和状态变化可见
- 站内通知工作正常
- 邮件测试链路工作正常
