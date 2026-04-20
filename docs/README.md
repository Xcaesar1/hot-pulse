# Hot Pulse 文档总览

这个目录用于沉淀 Hot Pulse 的需求、方案、技术决策与阶段实现状态，方便后续继续迭代 Web 与 Agent Skill。

## 文档列表
- [需求文档](./requirements/2026-04-17-hot-pulse-requirements.md)
- [实施方案](./plans/2026-04-17-hot-pulse-implementation.md)
- [信息源可靠性增强 v2](./plans/2026-04-20-source-reliability-v2.md)
- [热点准确度回调记录](./status/2026-04-20-accuracy-refresh.md)
- [技术决策记录](./research/2026-04-17-tech-decision-notes.md)
- [Web 实现状态](./status/2026-04-20-web-implementation-status.md)
- [前端刷新记录](./status/2026-04-20-frontend-refresh.md)

## 建议阅读顺序
1. 先看需求文档，确认产品边界、目标用户与核心使用场景。
2. 再看实施方案，理解系统结构、交付顺序与关键依赖。
3. 接着看信息源可靠性增强与热点准确度回调记录，了解最近两轮后端策略调整。
4. 最后结合技术决策记录与实现状态，快速判断当前系统做到哪里、下一步该继续优化什么。

## 当前阶段说明
- 当前已经完成 Web MVP 主链路与一轮前端视觉升级。
- 当前后端已经从“多源扩召回”调整为“X 主导发现 + 强新鲜度门槛”，重点压低旧内容与时间不明内容对热点流的干扰。
- Agent Skill 仍未开始开发，继续遵守“先把 Web 版验收通过”的要求。
