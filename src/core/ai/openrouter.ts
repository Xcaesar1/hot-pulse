import { getConfig } from "@/core/config";
import type { AIAnalysisResult, NotificationLevel } from "@/core/contracts";
import { clamp, truncate } from "@/core/utils";

const chinesePattern = /[\u3400-\u9fff]/;

function heuristicNotifyLevel(relevanceScore: number, credibilityRisk: number): NotificationLevel {
  if (relevanceScore >= 75 && credibilityRisk <= 40) return "high";
  if (relevanceScore >= 55) return "medium";
  return "low";
}

function hasChineseText(input: string) {
  return chinesePattern.test(input);
}

function shouldTranslateAnalysis(result: Pick<AIAnalysisResult, "summary" | "reasoning" | "credibilityReasoning">) {
  return !hasChineseText(result.summary) || !hasChineseText(result.reasoning) || !hasChineseText(result.credibilityReasoning);
}

async function requestOpenRouterJson(args: {
  prompt: string;
  systemPrompt: string;
  timeoutMs?: number;
}) {
  const config = getConfig();
  const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
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
          content: args.systemPrompt
        },
        {
          role: "user",
          content: args.prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(args.timeoutMs ?? 25000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${truncate(errorBody, 180)}`);
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
    throw new Error("OpenRouter returned no message content");
  }

  return rawContent;
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
    credibilityReasoning: truncate(String(parsed.credibilityReasoning ?? "No credibility reasoning provided."), 260),
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
    reasoning: `启发式兜底判断命中了 ${hits}/${keywords.length || 1} 个查询词。`,
    credibilityReasoning:
      credibilityRisk >= 50
        ? "启发式兜底检测到疑似传闻或未确认表述，因此下调了可信度。"
        : "启发式兜底没有在可用文本里发现明显的传闻型风险词。",
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
    reasoning: truncate(`由于 OpenRouter 当前不可用，本次改为启发式兜底分析：${reason}`, 260),
    credibilityReasoning: truncate(`由于 OpenRouter 当前不可用，真实性判断也改为启发式兜底：${reason}`, 260)
  };
}

async function translateAnalysisToChinese(result: AIAnalysisResult): Promise<AIAnalysisResult> {
  const prompt = `
Return a JSON object only.
Translate the following fields into concise Simplified Chinese. Keep the meaning accurate and do not add new facts.

{
  "summary": ${JSON.stringify(result.summary)},
  "reasoning": ${JSON.stringify(result.reasoning)},
  "credibilityReasoning": ${JSON.stringify(result.credibilityReasoning)}
}

Required JSON shape:
{
  "summary": string,
  "reasoning": string,
  "credibilityReasoning": string
}
`.trim();

  const rawContent = await requestOpenRouterJson({
    systemPrompt: "You are a precise translator. Always translate into concise Simplified Chinese and return JSON only.",
    prompt,
    timeoutMs: 20000
  });

  const first = rawContent.indexOf("{");
  const last = rawContent.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Translation response did not contain a JSON object");
  }

  const parsed = JSON.parse(rawContent.slice(first, last + 1)) as Partial<Pick<AIAnalysisResult, "summary" | "reasoning" | "credibilityReasoning">>;
  return {
    ...result,
    summary: truncate(String(parsed.summary ?? result.summary), 320),
    reasoning: truncate(String(parsed.reasoning ?? result.reasoning), 260),
    credibilityReasoning: truncate(String(parsed.credibilityReasoning ?? result.credibilityReasoning), 260)
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
All explanation fields must be written in concise Simplified Chinese.

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
  "credibilityReasoning": string,
  "suggestedNotify": "high" | "medium" | "low"
}

Scoring rules:
- relevanceScore: 0-100
- credibilityRisk: 0-100, lower is more trustworthy
- noveltyScore: 0-100
- summary, reasoning, credibilityReasoning: concise Simplified Chinese
`.trim();

  try {
    const rawContent = await requestOpenRouterJson({
      systemPrompt: "You evaluate hot topic signals. Always respond with a JSON object only. Write summary and explanations in concise Simplified Chinese.",
      prompt
    });
    const parsed = parseAnalysisPayload(rawContent);

    if (!shouldTranslateAnalysis(parsed)) {
      return parsed;
    }

    try {
      return await translateAnalysisToChinese(parsed);
    } catch (translationError) {
      console.error("[openrouter] translation fallback failed", {
        model: config.openRouterModel,
        reason: translationError instanceof Error ? translationError.message : "Unknown translation failure",
        url: input.url
      });
      return parsed;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    console.error("[openrouter] request failed", { reason, model: config.openRouterModel, url: input.url });
    return heuristicWithReason(input, reason);
  }
}

export { shouldTranslateAnalysis };
