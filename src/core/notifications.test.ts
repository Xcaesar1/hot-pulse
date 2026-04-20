import { describe, expect, it } from "vitest";
import { looksLikeUrl } from "@/core/utils";

describe("email configuration guards", () => {
  it("recognizes URL-shaped SMTP hosts as invalid", () => {
    expect(looksLikeUrl("https://www.google.com/search?q=smtp.163.com")).toBe(true);
    expect(looksLikeUrl("smtp.163.com")).toBe(false);
  });
});
