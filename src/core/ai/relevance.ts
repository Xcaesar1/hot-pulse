import type { CandidateDocument, MonitorMode } from "@/core/contracts";
import { uniqueStrings } from "@/core/utils";

export interface MonitorQueryExpansion {
  baseQuery: string;
  mode: MonitorMode;
  expandedTerms: string[];
  requiredTerms: string[];
  optionalTerms: string[];
}

export interface RelevancePrefilterResult extends MonitorQueryExpansion {
  keywordMentioned: boolean;
  matchedTerms: string[];
  missingRequiredTerms: string[];
  matchCoverage: number;
  strictReject: boolean;
  strictReview: boolean;
}

const latinTokenPattern = /[a-z0-9]+(?:[.-][a-z0-9]+)*/gi;
const versionPattern = /\b\d+(?:\.\d+)+\b/g;
const punctuationPattern = /[^\p{L}\p{N}\s.]+/gu;

function normalizePhrase(value: string) {
  return value
    .toLowerCase()
    .replace(punctuationPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value: string) {
  return normalizePhrase(value).replace(/\s+/g, "");
}

function collectLatinTokens(value: string) {
  return uniqueStrings(value.toLowerCase().match(latinTokenPattern) ?? []);
}

function collectVersionTokens(value: string) {
  return uniqueStrings(value.match(versionPattern) ?? []);
}

function buildSequenceVariants(value: string) {
  const normalized = normalizePhrase(value);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    return [];
  }

  const variants = new Set<string>();
  variants.add(words.join(" "));

  const reversed = [...words].reverse().join(" ");
  if (reversed !== normalized) {
    variants.add(reversed);
  }

  if (words.length === 3) {
    variants.add(`${words[0]} ${words[2]} ${words[1]}`);
    variants.add(`${words[1]} ${words[0]} ${words[2]}`);
  }

  return [...variants];
}

function buildVersionVariants(version: string) {
  const compact = version.replace(/[.\s]+/g, "");
  const spaced = version.replace(/[.]+/g, " ");
  return uniqueStrings([version, compact, spaced]);
}

function classifyRequiredTerms(query: string) {
  const normalized = normalizePhrase(query);
  const versions = collectVersionTokens(normalized);
  const latinTokens = collectLatinTokens(normalized).filter((token) => token.length >= 2 && !versions.includes(token));

  if (latinTokens.length > 0 || versions.length > 0) {
    return uniqueStrings([...latinTokens, ...versions]);
  }

  return normalized ? [normalized] : [];
}

export function expandMonitorQuery(args: {
  query: string;
  aliases?: string[];
  mode: MonitorMode;
}): MonitorQueryExpansion {
  const aliases = uniqueStrings(args.aliases ?? []);
  const requiredTerms = args.mode === "keyword" ? classifyRequiredTerms(args.query) : [];
  const phraseTerms = new Set<string>();

  for (const phrase of [args.query, ...aliases]) {
    if (!phrase.trim()) continue;
    phraseTerms.add(phrase);
    for (const variant of buildSequenceVariants(phrase)) {
      phraseTerms.add(variant);
    }

    for (const version of collectVersionTokens(phrase)) {
      for (const variant of buildVersionVariants(version)) {
        phraseTerms.add(variant);
      }
    }
  }

  const expandedTerms = uniqueStrings([...phraseTerms].map(normalizePhrase).filter(Boolean));
  const optionalTerms = expandedTerms.filter((term) => !requiredTerms.includes(term));

  return {
    baseQuery: args.query,
    mode: args.mode,
    expandedTerms,
    requiredTerms,
    optionalTerms
  };
}

function includesNormalized(corpus: string, rawTerm: string) {
  const normalizedTerm = normalizePhrase(rawTerm);
  if (!normalizedTerm) return false;
  if (normalizedTerm.includes(" ")) {
    return corpus.includes(normalizedTerm);
  }

  const compactCorpus = corpus.replace(/\s+/g, "");
  return corpus.includes(normalizedTerm) || compactCorpus.includes(normalizeCompact(rawTerm));
}

export function buildRelevancePrefilter(args: {
  query: string;
  aliases?: string[];
  mode: MonitorMode;
  document: Pick<CandidateDocument, "title" | "snippet" | "content">;
}): RelevancePrefilterResult {
  const expansion = expandMonitorQuery({
    query: args.query,
    aliases: args.aliases,
    mode: args.mode
  });

  if (args.mode === "topic") {
    return {
      ...expansion,
      keywordMentioned: false,
      matchedTerms: [],
      missingRequiredTerms: [],
      matchCoverage: 0,
      strictReject: false,
      strictReview: false
    };
  }

  const corpus = normalizePhrase([args.document.title, args.document.snippet, args.document.content].filter(Boolean).join(" "));
  const matchedTerms = expansion.expandedTerms.filter((term) => includesNormalized(corpus, term));
  const missingRequiredTerms = expansion.requiredTerms.filter((term) => !includesNormalized(corpus, term));
  const keywordMentioned = matchedTerms.length > 0;
  const matchCoverage =
    expansion.requiredTerms.length === 0
      ? matchedTerms.length > 0
        ? 100
        : 0
      : Math.round(((expansion.requiredTerms.length - missingRequiredTerms.length) / expansion.requiredTerms.length) * 100);

  return {
    ...expansion,
    keywordMentioned,
    matchedTerms,
    missingRequiredTerms,
    matchCoverage,
    strictReject: matchedTerms.length === 0,
    strictReview: matchedTerms.length > 0 && missingRequiredTerms.length > 0
  };
}

