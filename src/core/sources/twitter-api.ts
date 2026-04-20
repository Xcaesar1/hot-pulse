import { getConfig } from "@/core/config";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { normalizeCanonicalUrl, normalizeText, truncate, wait } from "@/core/utils";

interface TwitterApiTweet {
  id: string;
  url: string;
  text: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewCount?: number;
  isReply?: boolean;
  inReplyToId?: string | null;
  retweeted_tweet?: unknown;
  author?: {
    userName?: string;
    name?: string;
    isBlueVerified?: boolean;
    verifiedType?: string;
    followers?: number;
  };
}

interface TwitterApiResponse {
  tweets?: TwitterApiTweet[];
}

export function buildSearchQuery(query: string, minLikes: number, minRetweets: number) {
  return [query, "-filter:replies", "-filter:retweets", `min_faves:${minLikes}`, `min_retweets:${minRetweets}`].join(" ");
}

function isOriginalTweet(tweet: TwitterApiTweet, allowReplies: boolean) {
  if (tweet.retweeted_tweet) return false;
  if (!allowReplies && (tweet.isReply || tweet.inReplyToId)) return false;
  return true;
}

function hasEnoughEngagement(tweet: TwitterApiTweet, minLikes: number, minRetweets: number) {
  return (tweet.likeCount ?? 0) >= minLikes && (tweet.retweetCount ?? 0) >= minRetweets;
}

function computeTweetQuality(tweet: TwitterApiTweet, trustedAccounts: string[]) {
  const isTrustedAccount = trustedAccounts.some((item) => item.toLowerCase() === (tweet.author?.userName || "").toLowerCase());
  const followers = Number(tweet.author?.followers ?? 0);
  const engagement = (tweet.likeCount ?? 0) * 1.2 + (tweet.retweetCount ?? 0) * 2 + (tweet.quoteCount ?? 0) * 2.5 + (tweet.replyCount ?? 0) * 0.5;
  const followerScore = followers >= 500000 ? 22 : followers >= 50000 ? 16 : followers >= 10000 ? 10 : followers >= 1000 ? 6 : 2;
  const engagementScore = engagement >= 200 ? 24 : engagement >= 80 ? 18 : engagement >= 35 ? 12 : engagement >= 15 ? 8 : 2;
  return Math.min(100, 26 + (isTrustedAccount ? 22 : 0) + (tweet.author?.isBlueVerified ? 12 : 0) + followerScore + engagementScore);
}

export function isHighNoiseTweet(tweet: TwitterApiTweet, minLikes: number, minRetweets: number, allowReplies: boolean) {
  const text = normalizeText(tweet.text || "");
  if (!tweet.author?.userName) return true;
  if (text.length < 30) return true;
  if (!isOriginalTweet(tweet, allowReplies)) return true;
  if (!hasEnoughEngagement(tweet, minLikes, minRetweets)) return true;
  return false;
}

function mapTweet(
  sourceKey: string,
  sourceLabel: string,
  kind: CandidateDocument["sourceKind"],
  tweet: TwitterApiTweet,
  trustedAccounts: string[]
): CandidateDocument {
  const qualityScore = computeTweetQuality(tweet, trustedAccounts);
  const canonicalUrl = normalizeCanonicalUrl(tweet.url);
  return {
    sourceKey,
    sourceLabel,
    sourceKind: kind,
    externalId: tweet.id,
    title: truncate(normalizeText(tweet.text.replace(/\s+/g, " ").trim()), 110),
    url: canonicalUrl,
    snippet: truncate(normalizeText(tweet.text), 220),
    content: truncate(normalizeText(tweet.text), 1200),
    author: tweet.author?.userName ? normalizeText(tweet.author.userName) : tweet.author?.name ? normalizeText(tweet.author.name) : null,
    publishedAt: tweet.createdAt ?? null,
    metadata: {
      discoveryEngine: "twitterapi.io",
      evidenceFamily: "social",
      canonicalUrl,
      canonicalDomain: "x.com",
      tweetMetrics: {
        likes: tweet.likeCount ?? 0,
        reposts: tweet.retweetCount ?? 0,
        replies: tweet.replyCount ?? 0,
        quotes: tweet.quoteCount ?? 0,
        views: tweet.viewCount ?? 0
      },
      authorSignals: {
        trustedAccount: trustedAccounts.some((item) => item.toLowerCase() === (tweet.author?.userName || "").toLowerCase()),
        isBlueVerified: Boolean(tweet.author?.isBlueVerified),
        verifiedType: tweet.author?.verifiedType ?? null,
        followers: tweet.author?.followers ?? 0
      },
      qualitySignals: {
        score: qualityScore
      }
    }
  };
}

export function mapTwitterSearchResponse(
  sourceKey: string,
  sourceLabel: string,
  kind: CandidateDocument["sourceKind"],
  payload: TwitterApiResponse,
  trustedAccounts: string[] = []
) {
  return (payload.tweets ?? []).map((tweet) => mapTweet(sourceKey, sourceLabel, kind, tweet, trustedAccounts));
}

async function fetchTwitterApi<T>(
  path: string,
  searchParams: Record<string, string | boolean | number | undefined>,
  options?: { maxAttempts?: number; backoffMs?: number }
): Promise<T> {
  const apiKey = getConfig().twitterApiKey;
  if (!apiKey) {
    throw new Error("TWITTERAPI_IO_KEY is not configured");
  }
  const url = new URL(`https://api.twitterapi.io${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const maxAttempts = options?.maxAttempts ?? 3;
  const baseBackoffMs = options?.backoffMs ?? 1200;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey
      },
      signal: AbortSignal.timeout(12000)
    });
    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delayMs = retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * attempt;
      await wait(delayMs);
      continue;
    }

    throw new Error(`twitterapi.io request failed: ${response.status}`);
  }

  throw new Error("twitterapi.io request failed after retries");
}

export const twitterApiAdapter: SourceAdapter = {
  key: "twitter-api",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 8);
    const trustedAccounts = Array.isArray(context.source.config.trustedAccounts) ? context.source.config.trustedAccounts.map(String) : [];
    const usernames = Array.isArray(context.source.config.usernames) ? context.source.config.usernames.map(String) : [];
    const userFetchLimit = Number(context.source.config.userFetchLimit ?? 4);
    const backoffMs = Number(context.source.config.backoffMs ?? 1200);
    const queryType = String(context.source.config.queryType ?? "Top");
    const minLikes = Number(context.source.config.minLikes ?? 15);
    const minRetweets = Number(context.source.config.minRetweets ?? 5);
    const allowReplies = Boolean(context.source.config.allowReplies ?? false);
    const collected: CandidateDocument[] = [];

    try {
      const searchPayload = await fetchTwitterApi<TwitterApiResponse>(
        "/twitter/tweet/advanced_search",
        {
          query: buildSearchQuery(context.monitor.query, minLikes, minRetweets),
          queryType
        },
        {
          backoffMs
        }
      );
      collected.push(
        ...mapTwitterSearchResponse(context.source.key, context.source.label, context.source.kind, searchPayload, trustedAccounts)
          .filter((item) => {
            const metrics = (item.metadata.tweetMetrics as Record<string, unknown> | undefined) ?? {};
            const authorSignals = (item.metadata.authorSignals as Record<string, unknown> | undefined) ?? {};
            return !isHighNoiseTweet(
              {
                id: item.externalId,
                url: item.url,
                text: item.content,
                likeCount: Number(metrics.likes ?? 0),
                retweetCount: Number(metrics.reposts ?? 0),
                replyCount: Number(metrics.replies ?? 0),
                quoteCount: Number(metrics.quotes ?? 0),
                viewCount: Number(metrics.views ?? 0),
                author: {
                  userName: item.author ?? undefined,
                  isBlueVerified: Boolean(authorSignals.isBlueVerified),
                  followers: Number(authorSignals.followers ?? 0)
                }
              },
              minLikes,
              minRetweets,
              allowReplies
            );
          })
          .slice(0, maxResults)
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("429")) {
        throw error;
      }
    }

    for (const username of usernames.slice(0, userFetchLimit)) {
      try {
        const userPayload = await fetchTwitterApi<TwitterApiResponse>(
          "/twitter/user/last_tweets",
          {
            userName: username,
            includeReplies: allowReplies
          },
          {
            backoffMs
          }
        );
        collected.push(
          ...mapTwitterSearchResponse(context.source.key, context.source.label, context.source.kind, userPayload, trustedAccounts).filter((item) => {
            const metrics = (item.metadata.tweetMetrics as Record<string, unknown> | undefined) ?? {};
            const authorSignals = (item.metadata.authorSignals as Record<string, unknown> | undefined) ?? {};
            return (
              `${item.title} ${item.content}`.toLowerCase().includes(context.monitor.query.toLowerCase()) &&
              !isHighNoiseTweet(
                {
                  id: item.externalId,
                  url: item.url,
                  text: item.content,
                  likeCount: Number(metrics.likes ?? 0),
                  retweetCount: Number(metrics.reposts ?? 0),
                  replyCount: Number(metrics.replies ?? 0),
                  quoteCount: Number(metrics.quotes ?? 0),
                  viewCount: Number(metrics.views ?? 0),
                  author: {
                    userName: item.author ?? undefined,
                    isBlueVerified: Boolean(authorSignals.isBlueVerified),
                    followers: Number(authorSignals.followers ?? 0)
                  }
                },
                minLikes,
                minRetweets,
                allowReplies
              )
            );
          })
        );
        await wait(backoffMs);
      } catch (error) {
        if (error instanceof Error && error.message.includes("429")) {
          break;
        }
        throw error;
      }
    }

    return collected
      .sort(
        (left, right) =>
          Number((right.metadata.qualitySignals as Record<string, unknown> | undefined)?.score ?? 0) -
          Number((left.metadata.qualitySignals as Record<string, unknown> | undefined)?.score ?? 0)
      )
      .slice(0, maxResults);
  }
};
