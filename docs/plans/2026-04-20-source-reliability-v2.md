# Hot Pulse 信息源可靠性增强方案 v2

日期：2026-04-20

## 目标
- 进一步降低 `twitter-api` 噪音，只保留热门原创推文作为社交佐证。
- 在不替换现有搜索发现层的前提下，新增 `Startpage` 与 `Brave Search` 两个 `Axios + Cheerio` 搜索源。
- 保持现有多源评分与 canonical 去重框架不变，让新增源平滑进入现有热点聚合流程。

## 本轮决策
- 搜索策略：仅增新源，保留现有 `DuckDuckGo`、`Google News RSS`、`Bing RSS`。
- X 阈值策略：默认可配置，写入 `twitter-api` source config。
- strict 模式：全部硬过滤，点赞、转发、浏览量、粉丝数任一不达标都丢弃。
- 新增搜索引擎：`Startpage + Brave`。

## 关键实现
### X / Twitter
- `queryType` 固定为 `Top`。
- query 继续附加 `-filter:replies -filter:retweets min_faves min_retweets`。
- 严格模式默认阈值：
  - `minLikes: 10`
  - `minRetweets: 5`
  - `minViews: 500`
  - `minFollowers: 100`
- 过滤前置到原始 tweet 响应层，避免 reply / retweet / inReplyTo 状态在映射后丢失。
- 认证与白名单账号只参与质量加权，不替代硬门槛。

### 新增搜索引擎
- 新增 `startpage-search` 与 `brave-search` 两个适配器。
- 使用 `axios.create()` 建立抓取客户端，统一配置：
  - `timeout`
  - `headers`
  - `maxRedirects`
- 使用 `cheerio.load()` 解析 HTML，提取：
  - 标题
  - 链接
  - 摘要
  - 排名
- 对搜索结果落地页继续复用 `extractArticle()` 做正文抽取与 canonical 归一化。
- 搜索源仍属于 `search_discovery` 家族，只承担发现职责。

### 评分与聚合
- 继续使用 `evidenceFamily` 做多源确认。
- 新增搜索源 metadata 统一带上：
  - `discoveryEngine`
  - `evidenceFamily`
  - `canonicalUrl`
  - `canonicalDomain`
  - `qualitySignals`
- 新增搜索源的可靠性权重低于 `official/community`，高于弱社交信号。

## 验证要求
- X 严格模式测试覆盖 reply、retweet、低互动、低浏览、低粉丝等拒绝路径。
- Startpage / Brave 解析器都需要独立单测。
- 回归执行：
  - `pnpm test`
  - `pnpm lint`
  - `pnpm build`
