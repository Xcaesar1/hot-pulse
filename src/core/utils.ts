import { createHash, randomUUID } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(input: string, max = 300): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1))}\u2026`;
}

export function domainFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function repairMojibake(input: string): string {
  if (!/[ÂÃâ€]/.test(input)) {
    return input;
  }
  try {
    const repaired = Buffer.from(input, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? input : repaired;
  } catch {
    return input;
  }
}

export function normalizeText(input: string): string {
  const decoded = decodeHtmlEntities(input);
  const repaired = repairMojibake(decoded);
  return repaired.replace(/\u00A0/g, " ").replace(/\s+/g, " ").replace(/\s([?.!,;:])/g, "$1").trim();
}
