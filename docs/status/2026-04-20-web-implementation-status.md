# Hot Pulse 当前已实现功能清单

## 文档目的
这份文档用于记录截至 `2026-04-20` 已经落地的 Web 版块、核心能力、接口和验证状态，方便后续继续开发、联调和验收。

## 已实现的产品版块
### 1. Radar Desk 首页
- 已完成响应式 Web 首页
- 已完成 Hero 区、系统信号区、手动扫描按钮、测试通知按钮
- 已完成热点流、来源配置区、通知历史区、任务运行状态区
- 已完成具有辨识度的 Radar Desk 视觉风格：
  - 非对称布局
  - 情报面板风格
  - 自定义 token
  - 扫描感背景与热度条

涉及文件：
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/dashboard-shell.tsx`

### 2. 监控规则管理
- 已实现监控规则列表读取
- 已实现创建新监控规则
- 已实现更新监控规则的基础接口
- 默认检查频率已固定为 `30 分钟`
- 已支持两种规则模式：
  - `keyword`
  - `topic`

涉及文件：
- `src/app/api/monitors/route.ts`
- `src/app/api/monitors/[id]/route.ts`
- `src/core/db/index.ts`
- `src/core/defaults.ts`

### 3. 多源采集适配器
- 已实现以下来源适配器：
  - DuckDuckGo HTML Search
  - Google News RSS
  - X via `twitterapi.io`
  - Hacker News
  - Reddit Search
  - GitHub Releases Atom
  - Custom RSS
- 已实现来源注册表和统一适配器接口
- 已实现来源健康状态记录与错误回写
- 已实现目标页正文提取与来源白名单控制

涉及文件：
- `src/core/sources/base.ts`
- `src/core/sources/index.ts`
- `src/core/sources/*.ts`
- `src/core/extract.ts`

### 4. AI 分析与热点打分
- 已实现 OpenRouter 结构化分析调用
- 已实现当 OpenRouter 未配置时的 heuristic fallback
- 已实现热点指纹生成
- 已实现来源多样性、来源权重、传播速度和最终分数计算
- 已实现 `high / medium / low` 通知等级推导

涉及文件：
- `src/core/ai/openrouter.ts`
- `src/core/analysis/scoring.ts`
- `src/core/orchestrator.ts`

### 5. 数据持久化
- 已实现 SQLite 本地文件存储
- 已实现 Drizzle schema
- 已实现数据库 bootstrap
- 已实现默认监控规则与默认来源 seed
- 已实现热点、证据、通知、扫描运行记录等基础表结构

涉及文件：
- `src/core/db/schema.ts`
- `src/core/db/client.ts`
- `src/core/db/bootstrap.ts`
- `src/core/db/index.ts`
- `src/core/db/migrate.ts`

### 6. 扫描编排与 Worker
- 已实现手动扫描编排
- 已实现定时扫描 worker
- 已将 cron 固定为每 `30 分钟` 运行一次
- 已实现扫描运行记录与扫描摘要写入
- 已实现高优先级热点触发通知分发

涉及文件：
- `src/core/orchestrator.ts`
- `src/worker/index.ts`
- `src/worker/run-once.ts`

### 7. 通知能力
- 已实现站内通知入库
- 已实现 SMTP 邮件通知
- 已实现测试通知接口
- 已实现未配置邮件时的 graceful fallback

涉及文件：
- `src/core/notifications.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/test/route.ts`

### 8. Web API
已实现的 API Route Handlers：
- `GET /api/monitors`
- `POST /api/monitors`
- `PATCH /api/monitors/:id`
- `GET /api/hotspots`
- `GET /api/sources`
- `PATCH /api/sources/:id`
- `GET /api/notifications`
- `POST /api/notifications/test`
- `POST /api/scan/run`

## 已实现但仍需补强的部分
- 来源配置当前以 JSON 编辑为主，尚未做更细粒度的图形化表单
- 真实 API 冒烟联调依赖用户提供 OpenRouter、twitterapi.io、SMTP 环境变量
- Agent Skill 尚未开始实现
- 当前热点聚合逻辑已能工作，但后续仍可继续优化语义去重和跨源合并精度

## 本轮稳定性修复
- 已修正 worker / scan 进程读取 `.env.local` 与 `.env`，不再只依赖 Next.js 注入环境变量
- 已为 `twitterapi.io` 增加基础退避、降低默认请求量，并在限流时做部分成功返回
- 已为 Reddit 增加 RSS fallback，并在 fallback 失败时优雅降级为空结果
- 已修正默认 Custom RSS 配置，替换掉无效的 Anthropic RSS 地址
- 已增加文本标准化清洗，减轻 Google News / Hacker News / RSS 文本中的乱码与 HTML 实体问题

## 当前验证状态
- `pnpm test` 已通过
- `pnpm build` 已通过
- `pnpm lint` 已通过

## 技术依据说明
截至 `2026-04-20`，当前实现再次通过 MCP 复核了以下技术方向：
- Next.js 使用 App Router、Server Components 和 `app/api/**/route.ts` Route Handlers
- Drizzle ORM 使用 SQLite schema + 独立 config + 本地文件数据库模式
- Tailwind CSS 使用 `@theme` 和 CSS variables 管理设计 token

详细依据见：
- [技术决策记录](../research/2026-04-17-tech-decision-notes.md)
