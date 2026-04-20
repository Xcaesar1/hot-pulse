import { getConfig } from "@/core/config";
import type { AIAnalysisResult, MonitorMode, NotificationLevel, RelevanceMatchType } from "@/core/contracts";
import type { RelevancePrefilterResult } from "@/core/ai/relevance";
import { clamp, truncate } from "@/core/utils";

const chinesePattern = /[\u3400-\u9fff]/;
const matchTypeRank: Record<RelevanceMatchType, number> = {
  exact: 5,
  alias: 4,
  adjacent: 3,
  weak: 2,
  none: 1
};

function heuristicNotifyLevel(relevanceScore: number, credibilityRisk: number): NotificationLevel {
  if (relevanceScore >= 75 && credibilityRisk <= 40) return "high";
  if (relevanceScore >= 55) return "medium";
  return "low";
}

function hasChineseText(input: string) {
  return chinesePattern.test(input);
}

function safeMatchType(value: unknown): RelevanceMatchType {
  if (value === "exact" || value === "alias" || value === "adjacent" || value === "weak" || value === "none") {
    return value;
  }
  return "none";
}

export function shouldTranslateAnalysis(
  result: Pick<AIAnalysisResult, "summary" | "reasoning" | "credibilityReasoning" | "whyRelevant" | "whyNotRelevant">
) {
  return [result.summary, result.reasoning, result.credibilityReasoning, result.whyRelevant, result.whyNotRelevant].some(
    (value) => value.length > 0 && !hasChineseText(value)
  );
}

async function requestOpenRouterJson(args: {
  prompt: string;
  systemPrompt: string;
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
}) {
  const config = getConfig();
  const body: Record<string, unknown> = {
    model: config.openRouterModel,
    temperature: 0.1,
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
  };

  if (args.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "relevance_review",
        strict: true,
        schema: args.jsonSchema
      }
    };
  }

  const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.openRouterSiteUrl,
      "X-Title": config.openRouterSiteName
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(args.timeoutMs ?? 25000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${truncate(errorBody, 220)}`);
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

function baseFallback(input: { query: string; title: string; body: string; prefilter?: RelevancePrefilterResult }): AIAnalysisResult {
  const haystack = `${input.title} ${input.body}`.toLowerCase();
  const prefilter = input.prefilter;
  const directMention = prefilter?.keywordMentioned ?? false;
  const requiredCoverage = prefilter?.matchCoverage ?? 0;
  const missingRequiredTerms = prefilter?.missingRequiredTerms ?? [];
  const matchedTerms = prefilter?.matchedTerms ?? [];

  const matchType: RelevanceMatchType =
    directMention && missingRequiredTerms.length === 0
      ? "exact"
      : directMention
        ? "weak"
        : "none";

  const relevanceScore = clamp(
    directMention ? Math.max(requiredCoverage, missingRequiredTerms.length === 0 ? 82 : 62) : Math.min(requiredCoverage, 28)
  );
  const credibilityRisk = haystack.includes("rumor") || haystack.includes("unconfirmed") ? 60 : 28;
  const noveltyScore = haystack.includes("release") || haystack.includes("launch") || haystack.includes("update") ? 74 : 52;
  const whyRelevant =
    directMention && matchedTerms.length > 0
      ? `文本中直接出现了与监控词相关的词项：${matchedTerms.join("、")}。`
      : "文本中没有足够的直接词项证据支撑它与监控词高度相关。";
  const whyNotRelevant =
    missingRequiredTerms.length > 0
      ? `缺少核心词：${missingRequiredTerms.join("、")}，因此不能判定为严格直接相关。`
      : "没有发现明显的反例，但相关性证据仍然有限。";

  return {
    keywordMentioned: directMention,
    isRelevant: directMention && relevanceScore >= 45,
    relevanceScore,
    matchType,
    matchedTerms,
    missingRequiredTerms,
    whyRelevant: truncate(whyRelevant, 220),
    whyNotRelevant: truncate(whyNotRelevant, 220),
    credibilityRisk,
    noveltyScore,
    summary: truncate(
      directMention
        ? `这条内容与【${input.query}】存在直接词项关联，核心证据来自：${matchedTerms.slice(0, 3).join("、") || "正文提及" }。`
        : `这条内容与【${input.query}】缺少直接词项锚点，更像相邻话题或泛相关内容。`,
      320
    ),
    reasoning: truncate(`启发式兜底：${whyRelevant}`, 260),
    credibilityReasoning: truncate(
      credibilityRisk >= 50
        ? "启发式兜底检测到疑似传闻或未确认表述，因此下调可信度。"
        : "启发式兜底未在文本中发现明显的传闻型风险词。",
      260
    ),
    suggestedNotify: heuristicNotifyLevel(relevanceScore, credibilityRisk)
  };
}

export function heuristicAnalysis(input: { query: string; title: string; body: string; prefilter?: RelevancePrefilterResult }): AIAnalysisResult {
  return baseFallback(input);
}

function heuristicWithReason(
  input: { query: string; title: string; body: string; prefilter?: RelevancePrefilterResult },
  reason: string
): AIAnalysisResult {
  const fallback = baseFallback(input);
  return {
    ...fallback,
    reasoning: truncate(`由于 OpenRouter 当前不可用，本次改为启发式兜底分析：${reason}`, 260),
    credibilityReasoning: truncate(`由于 OpenRouter 当前不可用，真实性判断也改为启发式兜底：${reason}`, 260)
  };
}

function normalizeAnalysisPayload(parsed: Partial<AIAnalysisResult>): AIAnalysisResult {
  const keywordMentioned = Boolean(parsed.keywordMentioned);
  const matchType = safeMatchType(parsed.matchType);
  const matchedTerms = Array.isArray(parsed.matchedTerms)
    ? parsed.matchedTerms.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const missingRequiredTerms = Array.isArray(parsed.missingRequiredTerms)
    ? parsed.missingRequiredTerms.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const whyRelevant = truncate(String(parsed.whyRelevant ?? parsed.reasoning ?? "未提供相关性依据。"), 260);
  const whyNotRelevant = truncate(String(parsed.whyNotRelevant ?? "未提供不相关说明。"), 260);
  const reasoning = truncate(String(parsed.reasoning ?? whyRelevant), 260);

  return {
    keywordMentioned,
    isRelevant: Boolean(parsed.isRelevant),
    relevanceScore: clamp(Number(parsed.relevanceScore ?? 0)),
    matchType,
    matchedTerms,
    missingRequiredTerms,
    whyRelevant,
    whyNotRelevant,
    credibilityRisk: clamp(Number(parsed.credibilityRisk ?? 100)),
    noveltyScore: clamp(Number(parsed.noveltyScore ?? 0)),
    summary: truncate(String(parsed.summary ?? "未生成摘要。"), 320),
    reasoning,
    credibilityReasoning: truncate(String(parsed.credibilityReasoning ?? "未提供真实性判断。"), 260),
    suggestedNotify: (parsed.suggestedNotify as NotificationLevel) ?? "low"
  };
}

export function parseAnalysisPayload(raw: string): AIAnalysisResult {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("AI response did not contain a JSON object");
  }
  const parsed = JSON.parse(raw.slice(first, last + 1)) as Partial<AIAnalysisResult>;
  return normalizeAnalysisPayload(parsed);
}

async function translateAnalysisToChinese(result: AIAnalysisResult): Promise<AIAnalysisResult> {
  const prompt = `
Return a JSON object only.
Translate the following fields into concise Simplified Chinese. Keep the meaning accurate and do not add new facts.

{
  "summary": ${JSON.stringify(result.summary)},
  "reasoning": ${JSON.stringify(result.reasoning)},
  "credibilityReasoning": ${JSON.stringify(result.credibilityReasoning)},
  "whyRelevant": ${JSON.stringify(result.whyRelevant)},
  "whyNotRelevant": ${JSON.stringify(result.whyNotRelevant)}
}

Required JSON shape:
{
  "summary": string,
  "reasoning": string,
  "credibilityReasoning": string,
  "whyRelevant": string,
  "whyNotRelevant": string
}
`.trim();

  const rawContent = await requestOpenRouterJson({
    systemPrompt: "You are a precise translator. Always translate into concise Simplified Chinese and return JSON only.",
    prompt,
    jsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Simplified Chinese summary" },
        reasoning: { type: "string", description: "Simplified Chinese reasoning" },
        credibilityReasoning: { type: "string", description: "Simplified Chinese credibility reasoning" },
        whyRelevant: { type: "string", description: "Simplified Chinese relevance explanation" },
        whyNotRelevant: { type: "string", description: "Simplified Chinese non-relevance explanation" }
      },
      required: ["summary", "reasoning", "credibilityReasoning", "whyRelevant", "whyNotRelevant"],
      additionalProperties: false
    },
    timeoutMs: 20000
  });

  const first = rawContent.indexOf("{");
  const last = rawContent.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Translation response did not contain a JSON object");
  }

  const parsed = JSON.parse(rawContent.slice(first, last + 1)) as Partial<AIAnalysisResult>;
  return {
    ...result,
    summary: truncate(String(parsed.summary ?? result.summary), 320),
    reasoning: truncate(String(parsed.reasoning ?? result.reasoning), 260),
    credibilityReasoning: truncate(String(parsed.credibilityReasoning ?? result.credibilityReasoning), 260),
    whyRelevant: truncate(String(parsed.whyRelevant ?? result.whyRelevant), 260),
    whyNotRelevant: truncate(String(parsed.whyNotRelevant ?? result.whyNotRelevant), 260)
  };
}

function buildMatchGuidance(mode: MonitorMode, prefilter: RelevancePrefilterResult) {
  if (mode === "topic") {
    return "This is a topic monitor. Judge broad topical relevance, but still avoid generic summaries.";
  }

  return `
This is a strict keyword monitor.
- Prefer direct keyword evidence over broad topic similarity.
- Use keywordMentioned=true only when the content directly mentions the query or conservative expansion terms.
- Use matchType="exact" when all required terms are covered.
- Use matchType="alias" when the content directly names a trusted alias or reordered variant while still clearly pointing to the same entity.
- Use matchType="adjacent" when the content is only about a nearby concept, sibling product, same vendor, or same space.
- Use matchType="weak" when evidence is partial or ambiguous.
- Use matchType="none" when the content should not be kept.
- Missing required terms right now: ${prefilter.missingRequiredTerms.join(", ") || "none"}.
- Matched terms right now: ${prefilter.matchedTerms.join(", ") || "none"}.
`.trim();
}

export async function analyzeCandidate(input: {
  query: string;
  aliases?: string[];
  monitorMode: MonitorMode;
  expandedTerms: string[];
  prefilter: RelevancePrefilterResult;
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
You are reviewing whether a candidate document is directly relevant to the monitor query.
All explanation fields must be concise Simplified Chinese.

Monitor query: ${input.query}
Monitor mode: ${input.monitorMode}
Aliases: ${input.aliases?.join(", ") || "none"}
Conservative expansion terms: ${input.expandedTerms.join(", ") || "none"}
Source: ${input.sourceLabel}
URL: ${input.url}
Prefilter keywordMentioned: ${input.prefilter.keywordMentioned}
Prefilter matchedTerms: ${input.prefilter.matchedTerms.join(", ") || "none"}
Prefilter missingRequiredTerms: ${input.prefilter.missingRequiredTerms.join(", ") || "none"}
Prefilter matchCoverage: ${input.prefilter.matchCoverage}
Title: ${input.title}
Body:
${truncate(input.body, 3200)}

${buildMatchGuidance(input.monitorMode, input.prefilter)}

Important:
- summary must explain the relationship between this content and the monitor query.
- whyRelevant must explain why it should be kept.
- whyNotRelevant must explain what is missing or why it may be a false positive.
- Avoid generic article summaries that do not mention the monitor query relationship.
`.trim();

  try {
    const rawContent = await requestOpenRouterJson({
      systemPrompt:
        "You evaluate direct relevance for monitored hotspots. Always return JSON only. Prefer strict, evidence-based judgments over broad thematic similarity. Write all explanatory text in concise Simplified Chinese.",
      prompt,
      jsonSchema: {
        type: "object",
        properties: {
          keywordMentioned: {
            type: "boolean",
            description: "Whether the content directly mentions the monitor query or a conservative expansion term."
          },
          isRelevant: {
            type: "boolean",
            description: "Whether the content should pass the relevance gate for this monitor."
          },
          relevanceScore: {
            type: "number",
            description: "0-100 score for direct relevance to the monitor query."
          },
          matchType: {
            type: "string",
            enum: ["exact", "alias", "adjacent", "weak", "none"],
            description: "How strongly the content matches the monitor query."
          },
          matchedTerms: {
            type: "array",
            items: { type: "string" },
            description: "Terms from the query expansion that were actually matched."
          },
          missingRequiredTerms: {
            type: "array",
            items: { type: "string" },
            description: "Required terms still missing from the content."
          },
          whyRelevant: {
            type: "string",
            description: "Concise Simplified Chinese explanation for why the content should be kept."
          },
          whyNotRelevant: {
            type: "string",
            description: "Concise Simplified Chinese explanation for what makes the content risky or not directly relevant."
          },
          summary: {
            type: "string",
            description: "Concise Simplified Chinese summary of the relationship between the content and the monitor query."
          },
          credibilityRisk: {
            type: "number",
            description: "0-100 credibility risk, lower is better."
          },
          noveltyScore: {
            type: "number",
            description: "0-100 novelty score."
          },
          credibilityReasoning: {
            type: "string",
            description: "Concise Simplified Chinese credibility explanation."
          },
          suggestedNotify: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Suggested urgency level."
          }
        },
        required: [
          "keywordMentioned",
          "isRelevant",
          "relevanceScore",
          "matchType",
          "matchedTerms",
          "missingRequiredTerms",
          "whyRelevant",
          "whyNotRelevant",
          "summary",
          "credibilityRisk",
          "noveltyScore",
          "credibilityReasoning",
          "suggestedNotify"
        ],
        additionalProperties: false
      }
    });

    const parsed = parseAnalysisPayload(rawContent);
    const normalized = {
      ...parsed,
      reasoning: parsed.isRelevant ? parsed.whyRelevant : parsed.whyNotRelevant
    };

    if (!shouldTranslateAnalysis(normalized)) {
      return normalized;
    }

    try {
      return await translateAnalysisToChinese(normalized);
    } catch (translationError) {
      console.error("[openrouter] translation fallback failed", {
        model: config.openRouterModel,
        reason: translationError instanceof Error ? translationError.message : "Unknown translation failure",
        url: input.url
      });
      return normalized;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    console.error("[openrouter] request failed", { reason, model: config.openRouterModel, url: input.url });
    return heuristicWithReason(input, reason);
  }
}

export function compareAnalysisStrength(
  left: Pick<AIAnalysisResult, "keywordMentioned" | "matchType" | "missingRequiredTerms" | "relevanceScore">,
  right: Pick<AIAnalysisResult, "keywordMentioned" | "matchType" | "missingRequiredTerms" | "relevanceScore">
) {
  return (
    Number(right.keywordMentioned) - Number(left.keywordMentioned) ||
    matchTypeRank[right.matchType] - matchTypeRank[left.matchType] ||
    left.missingRequiredTerms.length - right.missingRequiredTerms.length ||
    right.relevanceScore - left.relevanceScore
  );
}

export { safeMatchType };
