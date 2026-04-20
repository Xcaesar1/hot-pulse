import { describe, expect, it } from "vitest";
import { normalizeText } from "@/core/utils";

describe("normalizeText", () => {
  it("repairs common mojibake and html entities", () => {
    const result = normalizeText("Claude CodeÂ Â Hackaday &#x2F; News");

    expect(result).toBe("Claude Code Hackaday / News");
  });
});
