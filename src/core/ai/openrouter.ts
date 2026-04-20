import { getConfig } from "@/core/config";
import type { AIAnalysisResult, NotificationLevel } from "@/core/contracts";
import { clamp, truncate } from "@/core/utils";

function heuristicNotifyLevel(relevanceScore: number, credibilityRisk: number): NotificationLevel {
  if (relevanceScore >= 75 && credibilityRisk <= 40) return "high";
  if (relevanceScore >= 55) return "medium";
  return "low";
}

export function parseAnalysisPayload(raw: string): AIAnalysisResult {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("AI response did not contain a JSON object");
  }
  const parsed = JSON.parse(raw.slice(first, last + 1)) as Partial<AIAnalysisResult>;
  return {
    isRelevant: Boolean(parsed.isRelevant),
    relevanceScore: clamp(Number(parsed.relevanceScore ?? 0)),
    credibilityRisk: clamp(Number(parsed.credibilityRisk ?? 100)),
    noveltyScore: clamp(Number(parsed.noveltyScore ?? 0)),
    summary: truncate(String(parsed.summary ?? "No summary produced."), 320),
    reasoning: truncate(String(parsed.reasoning ?? "No reasoning provided."), 260),
    suggestedNotify: (parsed.suggestedNotify as NotificationLevel) ?? "low"
  };
}

export function heuristicAnalysis(input: { query: string; title: string; body: string }): AIAnalysisResult {
  const haystack = `${input.title} ${input.body}`.toLowerCase();
  const keywords = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const hits = keywords.filter((term) => haystack.includes(term)).length;
  const relevanceScore = clamp((hits / Math.max(keywords.length, 1)) * 100);
  const credibilityRisk = haystack.includes("rumor") || haystack.includes("unconfirmed") ? 60 : 28;
  const noveltyScore = haystack.includes("release") || haystack.includes("launch") || haystack.includes("update") ? 74 : 52;
  return {
    isRelevant: relevanceScore >= 45,
    relevanceScore,
    credibilityRisk,
    noveltyScore,
    summary: truncate(input.body || input.title, 220),
    reasoning: `Heuristic fallback matched ${hits}/${keywords.length || 1} query terms.`,
    suggestedNotify: heuristicNotifyLevel(relevanceScore, credibilityRisk)
  };
}

function heuristicWithReason(
  input: { query: string; title: string; body: string },
  reason: string
): AIAnalysisResult {
  const fallback = heuristicAnalysis(input);
  return {
    ...fallback,
    reasoning: truncate(`Fallback analysis used because OpenRouter was unavailable: ${reason}`, 260)
  };
}

export async function analyzeCandidate(input: {
  query: string;
  title: string;
  body: string;
  sourceLabel: string;
  url: string;
}): Promise<AIAnalysisResult> {
  const config = getConfig();
  if (!config.openRouterApiKey) {
    return heuristicWithReason(input, "OPENROUTER_API_KEY is missing");
  }

  const prompt = `
Return a JSON object only.
You are verifying whether a candidate document is a meaningful emerging hotspot for a monitor query.

Monitor query: ${input.query}
Source: ${input.sourceLabel}
URL: ${input.url}
Title: ${input.title}
Body:
${truncate(input.body, 2800)}

Required JSON shape:
{
  "isRelevant": boolean,
  "relevanceScore": number,
  "credibilityRisk": number,
  "noveltyScore": number,
  "summary": string,
  "reasoning": string,
  "suggestedNotify": "high" | "medium" | "low"
}

Scoring rules:
- relevanceScore: 0-100
- credibilityRisk: 0-100, lower is more trustworthy
- noveltyScore: 0-100
`.trim();

  let response: Response;
  try {
    response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.openRouterSiteUrl,
        "X-Title": config.openRouterSiteName
      },
      body: JSON.stringify({
        model: config.openRouterModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You evaluate hot topic signals. Always respond with a JSON object only."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    console.error("[openrouter] request failed", { reason, model: config.openRouterModel, url: input.url });
    return heuristicWithReason(input, reason);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[openrouter] non-200 response", {
      status: response.status,
      model: config.openRouterModel,
      body: truncate(errorBody, 400),
      url: input.url
    });
    return heuristicWithReason(input, `HTTP ${response.status}: ${truncate(errorBody, 140)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    return heuristicWithReason(input, "OpenRouter returned no message content");
  }

  try {
    return parseAnalysisPayload(rawContent);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not parse AI JSON";
    console.error("[openrouter] invalid JSON payload", {
      model: config.openRouterModel,
      reason,
      rawContent: truncate(rawContent, 400),
      url: input.url
    });
    return heuristicWithReason(input, reason);
  }
}
