# Hot Pulse 技术决策记录

## 使用依据
本项目在开始编码前，先通过 MCP 获取最新技术实现方法，再结合官方 API 文档对齐外部接入细节，避免引用过时写法。

## 2026-04-20 MCP 复核结果
### Next.js
- 再次通过 MCP 确认：
  - App Router 下推荐用 async Server Components 直接做服务端数据获取
  - API 仍推荐放在 `app/api/**/route.ts`
  - 动态数据请求推荐显式使用 `cache: 'no-store'`
  - `typedRoutes` 作为顶层 Next 配置项持续可用

### Drizzle ORM
- 再次通过 MCP 确认：
  - SQLite schema 继续使用 `drizzle-orm/sqlite-core`
  - 本地文件数据库和独立 `drizzle.config.ts` 是合理路径
  - 关系、索引、类型推导仍建议在 schema 层显式声明

### Tailwind CSS
- 再次通过 MCP 确认：
  - Tailwind v4 继续推荐用 `@theme` 管理 token
  - 设计令牌会自动暴露为 CSS variables，便于运行时复用
  - 自定义字体、颜色、断点、动画都适合在 token 层统一管理

## MCP 调研结果
### Next.js
- 来源：Context7 ` /vercel/next.js `
- 参考主题：App Router Route Handlers、Server Components 数据获取
- 结论：
  - 使用 App Router
  - 页面优先采用 Server Components 获取数据
  - API 使用 `app/api/**/route.ts` Route Handlers
  - 需要动态数据时使用 `fetch(..., { cache: 'no-store' })`

### Drizzle ORM
- 来源：Context7 ` /drizzle-team/drizzle-orm-docs `
- 参考主题：SQLite setup、schema definition、Drizzle config
- 结论：
  - SQLite schema 使用 `drizzle-orm/sqlite-core`
  - Drizzle config 采用独立 `drizzle.config.ts`
  - SQLite 驱动优先使用 `drizzle-orm/libsql`
  - 迁移目录使用 `drizzle/`

### Tailwind CSS
- 来源：Context7 ` /tailwindlabs/tailwindcss.com `
- 参考主题：`@theme`、CSS variables、自定义 design token
- 结论：
  - 使用 CSS variables / `@theme` 风格组织设计令牌
  - 自定义字体、颜色、动画、断点优先走 token 化方案
  - 适合本项目构建高辨识度 Dashboard 风格

## 外部 API 对接决策
### OpenRouter
- 采用 OpenAI-compatible HTTP 接口方式接入
- 官方文档：
  - https://openrouter.ai/docs/api-reference/overview
- 通过环境变量控制：
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`
  - `OPENROUTER_BASE_URL`
- 结构化 JSON 输出由应用层做 schema 校验

### twitterapi.io
- 采用 `X-API-Key` 头鉴权
- 官方文档：
  - https://docs.twitterapi.io/
  - https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
  - https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets
- 第一阶段重点接入：
  - 高级搜索
  - 指定用户最近推文
- 统一映射为内部候选内容结构，避免上层依赖第三方字段

## 设计方向
- 使用 `ui-ux-pro-max` 要求输出 Radar Desk 风格
- 通过非对称分栏、热度信号条、时间轴卡片流、扫描感背景实现差异化视觉
