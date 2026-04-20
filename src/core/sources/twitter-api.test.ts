import { describe, expect, it } from "vitest";
import { buildSearchQuery, isHighNoiseTweet, mapTwitterSearchResponse } from "@/core/sources/twitter-api";

describe("twitterapi mapper", () => {
  it("maps advanced search tweets into candidate documents", () => {
    const items = mapTwitterSearchResponse("twitter-api", "X via twitterapi.io", "social", {
      tweets: [
        {
          id: "1",
          url: "https://x.com/example/status/1",
          text: "OpenAI ships a new coding model today",
          createdAt: "2026-04-17T10:00:00.000Z",
          isReply: false,
          likeCount: 25,
          retweetCount: 8,
          author: {
            userName: "openai",
            isBlueVerified: true,
            followers: 1000000
          }
        }
      ]
    }, ["openai"]);

    expect(items).toHaveLength(1);
    expect(items[0]?.author).toBe("openai");
    expect(items[0]?.url).toContain("x.com");
    expect(items[0]?.metadata.evidenceFamily).toBe("social");
  });

  it("builds a strict advanced search query", () => {
    expect(buildSearchQuery("gpt-5.4", 15, 5)).toContain("-filter:replies");
    expect(buildSearchQuery("gpt-5.4", 15, 5)).toContain("-filter:retweets");
    expect(buildSearchQuery("gpt-5.4", 15, 5)).toContain("min_faves:15");
    expect(buildSearchQuery("gpt-5.4", 15, 5)).toContain("min_retweets:5");
  });

  it("filters reply noise and low-engagement tweets", () => {
    expect(
      isHighNoiseTweet(
        {
          id: "reply-1",
          url: "https://x.com/example/status/1",
          text: "This is a reply that should not pass the strict filter for signal discovery.",
          createdAt: "2026-04-17T10:00:00.000Z",
          isReply: true,
          likeCount: 80,
          retweetCount: 20,
          author: {
            userName: "someone"
          }
        },
        15,
        5,
        false
      )
    ).toBe(true);

    expect(
      isHighNoiseTweet(
        {
          id: "low-1",
          url: "https://x.com/example/status/2",
          text: "A short signal post that still fails because it barely has any engagement at all.",
          createdAt: "2026-04-17T10:00:00.000Z",
          isReply: false,
          likeCount: 2,
          retweetCount: 0,
          author: {
            userName: "someone"
          }
        },
        15,
        5,
        false
      )
    ).toBe(true);

    expect(
      isHighNoiseTweet(
        {
          id: "pass-1",
          url: "https://x.com/example/status/3",
          text: "OpenAI ships a substantial platform update and the post is long enough to survive the strict quality filter.",
          createdAt: "2026-04-17T10:00:00.000Z",
          isReply: false,
          likeCount: 30,
          retweetCount: 8,
          author: {
            userName: "openai",
            isBlueVerified: true,
            followers: 1000000
          }
        },
        15,
        5,
        false
      )
    ).toBe(false);
  });
});
