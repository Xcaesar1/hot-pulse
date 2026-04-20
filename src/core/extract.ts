import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { getConfig } from "@/core/config";
import { domainFromUrl, normalizeText, truncate } from "@/core/utils";

export interface ExtractedDocument {
  title: string;
  text: string;
}

function isAllowed(url: string): boolean {
  const host = domainFromUrl(url);
  const allowlist = getConfig().sourceAllowlist;
  return allowlist.length === 0 || allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "HotPulseBot/0.1 (+https://localhost)"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export async function extractArticle(url: string): Promise<ExtractedDocument | null> {
  if (!isAllowed(url)) {
    return null;
  }

  const html = await fetchText(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) return null;

  return {
    title: normalizeText(article.title || url),
    text: truncate(normalizeText(article.textContent?.replace(/\s+/g, " ").trim() || ""), 3500)
  };
}
