import { describe, expect, it } from "vitest";
import { inferQuickSearchMode } from "@/core/quick-search";

describe("inferQuickSearchMode", () => {
  it("treats entity and version queries as keyword searches", () => {
    expect(inferQuickSearchMode("Claude Sonnet 4.6")).toBe("keyword");
    expect(inferQuickSearchMode("Qwen3-Coder")).toBe("keyword");
    expect(inferQuickSearchMode("@OpenAI")).toBe("keyword");
  });

  it("treats natural language questions as topic searches", () => {
    expect(inferQuickSearchMode("最近有哪些 AI 编程热点值得关注？")).toBe("topic");
    expect(inferQuickSearchMode("What are the latest agentic coding trends")).toBe("topic");
    expect(inferQuickSearchMode("如何判断 AI 编程工具的真实热度")).toBe("topic");
  });
});
