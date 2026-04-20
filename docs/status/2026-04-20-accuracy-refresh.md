# Hot Pulse 热点准确度回调记录

日期：2026-04-20

## 背景
在引入更多搜索源后，系统召回上升了，但热点准确度明显下降。主要问题不是“源不够多”，而是：

- 搜索结果与 RSS 候选里混入了较多旧内容
- 一部分搜索候选缺少明确发布时间，却仍参与了热点升级
- 多源聚合更像在放大召回，而不是优先服务“第一时间发现值得发的内容”

## 本轮调整
- 恢复 `twitter-api` 为主发现源，搜索 / RSS / 社区源降级为补充发现与佐证层。
- 新增统一 freshness 评估：
  - `24h` 内视为 `fresh`
  - 超出 `24h` 视为 `stale`
  - 无明确发布时间视为 `unknown`
- 搜索结果会优先尝试从结果页时间文本和正文页 meta 中补抓发布时间。
- 热点评分新增 `freshnessScore`，并要求 `medium/high` 至少存在一条新鲜主发现或高可靠证据。
- 时间不明或过旧内容仍可保留为低优先级候选，但不会直接升级为高等级热点。

## 新增数据字段
- `CandidateDocument.metadata`
  - `freshnessHours`
  - `freshnessState`
  - `publishedAtSource`
- `HotspotEvidenceRecord`
  - `freshnessState`
  - `isFreshEvidence`
- `HotspotView`
  - `freshnessScore`
  - `hasFreshPrimaryEvidence`
  - `candidateState`

## 结果预期
- X 新推文会更容易成为热点入口。
- 搜索与 RSS 更适合承担“外部扩散佐证”角色。
- 旧文章、多搜索引擎重复命中的陈年内容，会明显更难进入热点流前排。
- 页面上最先看到的内容，应更接近“现在就值得判断、现在就值得发”的信息。

## 验证
- `pnpm test`
- `pnpm lint`
- `pnpm build`

本轮验证已全部通过。
