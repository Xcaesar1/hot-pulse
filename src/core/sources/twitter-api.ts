import { getConfig } from "@/core/config";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { normalizeText, truncate, wait } from "@/core/utils";

interface TwitterApiTweet {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewCount?: number;
  author?: {
    userName?: string;
    name?: string;
  };
}

interface TwitterApiResponse {
  tweets?: TwitterApiTweet[];
}

function mapTweet(sourceKey: string, sourceLabel: string, kind: CandidateDocument["sourceKind"], tweet: TwitterApiTweet): CandidateDocument {
  return {
    sourceKey,
    sourceLabel,
    sourceKind: kind,
    externalId: tweet.id,
    title: truncate(normalizeText(tweet.text.replace(/\s+/g, " ").trim()), 110),
    url: tweet.url,
    snippet: truncate(normalizeText(tweet.text), 220),
    content: truncate(normalizeText(tweet.text), 1200),
    author: tweet.author?.userName ? normalizeText(tweet.author.userName) : tweet.author?.name ? normalizeText(tweet.author.name) : null,
    publishedAt: tweet.createdAt,
    metadata: {
      metrics: {
        likes: tweet.likeCount ?? 0,
        reposts: tweet.retweetCount ?? 0,
        replies: tweet.replyCount ?? 0,
        quotes: tweet.quoteCount ?? 0,
        views: tweet.viewCount ?? 0
      }
    }
  };
}

export function mapTwitterSearchResponse(sourceKey: string, sourceLabel: string, kind: CandidateDocument["sourceKind"], payload: TwitterApiResponse) {
  return (payload.tweets ?? []).map((tweet) => mapTweet(sourceKey, sourceLabel, kind, tweet));
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
    const usernames = Array.isArray(context.source.config.usernames) ? context.source.config.usernames : [];
    const userFetchLimit = Number(context.source.config.userFetchLimit ?? 2);
    const backoffMs = Number(context.source.config.backoffMs ?? 1200);
    const collected: CandidateDocument[] = [];

    try {
      const searchPayload = await fetchTwitterApi<TwitterApiResponse>(
        "/twitter/tweet/advanced_search",
        {
          query: context.monitor.query
        },
        {
          backoffMs
        }
      );
      collected.push(...mapTwitterSearchResponse(context.source.key, context.source.label, context.source.kind, searchPayload).slice(0, maxResults));
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
            includeReplies: false
          },
          {
            backoffMs
          }
        );
        collected.push(
          ...mapTwitterSearchResponse(context.source.key, context.source.label, context.source.kind, userPayload).filter((item) =>
            `${item.title} ${item.content}`.toLowerCase().includes(context.monitor.query.toLowerCase())
          )
        );
        await wait(backoffMs);
      } catch (error) {
        if (error instanceof Error && error.message.includes("429")) {
          break;
        }
        throw error;
      }
    }

    return collected.slice(0, maxResults);
  }
};
