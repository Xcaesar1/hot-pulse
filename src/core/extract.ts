import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { getConfig } from "@/core/config";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

export interface ExtractedDocument {
  title: string;
  text: string;
  canonicalUrl: string;
  finalUrl: string;
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

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "HotPulseBot/0.1 (+https://localhost)"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return {
    html: await response.text(),
    finalUrl: response.url || url
  };
}

export async function extractArticle(url: string): Promise<ExtractedDocument | null> {
  if (!isAllowed(url)) {
    return null;
  }

  const fetched = await fetchHtml(url);
  const dom = new JSDOM(fetched.html, { url: fetched.finalUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) return null;

  const canonicalHref =
    dom.window.document.querySelector("link[rel='canonical']")?.getAttribute("href") ||
    dom.window.document.querySelector("meta[property='og:url']")?.getAttribute("content") ||
    fetched.finalUrl;
  const canonicalUrl = normalizeCanonicalUrl(new URL(canonicalHref, fetched.finalUrl).toString());

  return {
    title: normalizeText(article.title || fetched.finalUrl),
    text: truncate(normalizeText(article.textContent?.replace(/\s+/g, " ").trim() || ""), 3500),
    canonicalUrl,
    finalUrl: normalizeCanonicalUrl(fetched.finalUrl)
  };
}
