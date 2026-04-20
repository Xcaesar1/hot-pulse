# Hot Pulse

多源热点雷达 MVP。先交付 Web 端，再复用同一套 `core` 能力做 Agent Skill。

## Stack
- Next.js App Router
- Tailwind CSS v4 tokens
- SQLite + Drizzle ORM
- OpenRouter
- twitterapi.io
- Node worker + cron

## Quick Start
1. 复制 `.env.example` 为 `.env`
2. 安装依赖：`pnpm install`
3. 启动 Web：`pnpm dev`
4. 启动 Worker：`pnpm worker`
5. 手动跑一轮扫描：`pnpm scan`

## Required Env
- `OPENROUTER_API_KEY`
- `TWITTERAPI_IO_KEY`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `ALERT_EMAIL_TO`

## Docs
- [文档总览](./docs/README.md)
- [需求文档](./docs/requirements/2026-04-17-hot-pulse-requirements.md)
- [实施方案](./docs/plans/2026-04-17-hot-pulse-implementation.md)
- [技术决策](./docs/research/2026-04-17-tech-decision-notes.md)
- [当前已实现功能清单](./docs/status/2026-04-20-web-implementation-status.md)
