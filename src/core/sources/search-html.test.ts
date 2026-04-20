import { describe, expect, it } from "vitest";
import { parseBraveResults } from "@/core/sources/brave-search";
import { parseStartpageResults } from "@/core/sources/startpage-search";

describe("HTML search parsers", () => {
  it("parses Startpage result cards", () => {
    const results = parseStartpageResults(`
      <div class="w-gl__result">
        <a class="w-gl__result-title" href="https://openai.com/blog/new-model?utm_source=x">OpenAI launches new model</a>
        <p class="w-gl__description">A fresh research update for AI coding.</p>
      </div>
    `);

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toContain("OpenAI");
    expect(results[0]?.url).toBe("https://openai.com/blog/new-model");
    expect(results[0]?.snippet).toContain("research update");
  });

  it("parses Brave search snippets", () => {
    const results = parseBraveResults(`
      <div class="snippet" data-type="web">
        <a class="heading-serpresult" href="https://www.anthropic.com/news/claude-code?utm_medium=ref">
          <span class="title">Claude Code ships another update</span>
        </a>
        <div class="description">Anthropic details changes for developers.</div>
      </div>
    `);

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toContain("Claude Code");
    expect(results[0]?.url).toBe("https://www.anthropic.com/news/claude-code");
    expect(results[0]?.snippet).toContain("developers");
  });

  it("returns an empty list when HTML does not contain result cards", () => {
    expect(parseStartpageResults("<div>No results</div>")).toEqual([]);
    expect(parseBraveResults("<div>No results</div>")).toEqual([]);
  });
});
