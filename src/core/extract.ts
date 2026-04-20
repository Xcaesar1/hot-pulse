import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { getConfig } from "@/core/config";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

export interface ExtractedDocument {
  title: string;
  text: string;
  canonicalUrl: string;
  finalUrl: string;
  publishedAt: string | null;
  publishedAtSource: "article_meta" | null;
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

function safeIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function extractJsonLdPublishedAt(document: Document): string | null {
  const scripts = [...document.querySelectorAll("script[type='application/ld+json']")];
  for (const script of scripts) {
    const content = script.textContent?.trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as unknown;
      const queue = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of queue) {
        if (!entry || typeof entry !== "object") continue;
        const candidate = entry as Record<string, unknown>;
        const value = candidate.datePublished ?? candidate.dateCreated ?? candidate.uploadDate;
        const iso = safeIso(typeof value === "string" ? value : null);
        if (iso) return iso;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractPublishedAt(document: Document): string | null {
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='article:published_time']",
    "meta[property='og:article:published_time']",
    "meta[name='pubdate']",
    "meta[name='publishdate']",
    "meta[itemprop='datePublished']",
    "meta[property='og:pubdate']"
  ];

  for (const selector of metaSelectors) {
    const value =
      document.querySelector(selector)?.getAttribute("content") ||
      document.querySelector(selector)?.getAttribute("datetime");
    const iso = safeIso(value);
    if (iso) return iso;
  }

  const timeNode = document.querySelector("time[datetime]");
  const timeValue = safeIso(timeNode?.getAttribute("datetime"));
  if (timeValue) return timeValue;

  return extractJsonLdPublishedAt(document);
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
  const publishedAt = extractPublishedAt(dom.window.document);

  return {
    title: normalizeText(article.title || fetched.finalUrl),
    text: truncate(normalizeText(article.textContent?.replace(/\s+/g, " ").trim() || ""), 3500),
    canonicalUrl,
    finalUrl: normalizeCanonicalUrl(fetched.finalUrl),
    publishedAt,
    publishedAtSource: publishedAt ? "article_meta" : null
  };
}
