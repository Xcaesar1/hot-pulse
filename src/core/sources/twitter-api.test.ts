import { describe, expect, it } from "vitest";
import { mapTwitterSearchResponse } from "@/core/sources/twitter-api";

describe("twitterapi mapper", () => {
  it("maps advanced search tweets into candidate documents", () => {
    const items = mapTwitterSearchResponse("twitter-api", "X via twitterapi.io", "social", {
      tweets: [
        {
          id: "1",
          url: "https://x.com/example/status/1",
          text: "OpenAI ships a new coding model today",
          createdAt: "2026-04-17T10:00:00.000Z",
          author: {
            userName: "openai"
          }
        }
      ]
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.author).toBe("openai");
    expect(items[0]?.url).toContain("x.com");
  });
});
