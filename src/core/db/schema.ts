import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const monitors = sqliteTable("monitors", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  query: text("query").notNull(),
  mode: text("mode").notNull(),
  aliases: text("aliases").notNull().default("[]"),
  checkIntervalMinutes: integer("check_interval_minutes").notNull().default(30),
  minRelevanceScore: integer("min_relevance_score").notNull().default(60),
  notifyEmail: integer("notify_email", { mode: "boolean" }).notNull().default(false),
  notifyInApp: integer("notify_in_app", { mode: "boolean" }).notNull().default(true),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    config: text("config").notNull().default("{}"),
    lastStatus: text("last_status").notNull().default("idle"),
    lastRunAt: text("last_run_at"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    keyIdx: uniqueIndex("sources_key_idx").on(table.key)
  })
);

export const candidateDocuments = sqliteTable(
  "candidate_documents",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    snippet: text("snippet").notNull().default(""),
    content: text("content").notNull().default(""),
    author: text("author"),
    publishedAt: text("published_at"),
    hash: text("hash").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    uniqueCandidate: uniqueIndex("candidate_source_external_idx").on(table.sourceId, table.externalId)
  })
);

export const hotspots = sqliteTable(
  "hotspots",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    summary: text("summary").notNull().default(""),
    notifyLevel: text("notify_level").notNull().default("low"),
    relevanceScore: integer("relevance_score").notNull().default(0),
    credibilityRisk: integer("credibility_risk").notNull().default(100),
    noveltyScore: integer("novelty_score").notNull().default(0),
    sourceDiversityScore: integer("source_diversity_score").notNull().default(0),
    sourceAuthorityScore: integer("source_authority_score").notNull().default(0),
    sourceReliabilityScore: integer("source_reliability_score").notNull().default(0),
    velocityScore: integer("velocity_score").notNull().default(0),
    finalScore: integer("final_score").notNull().default(0),
    evidenceCount: integer("evidence_count").notNull().default(0),
    notified: integer("notified", { mode: "boolean" }).notNull().default(false),
    monitorLabels: text("monitor_labels").notNull().default("[]"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    metadata: text("metadata").notNull().default("{}")
  },
  (table) => ({
    fingerprintIdx: uniqueIndex("hotspots_fingerprint_idx").on(table.fingerprint)
  })
);

export const hotspotEvidences = sqliteTable(
  "hotspot_evidences",
  {
    id: text("id").primaryKey(),
    hotspotId: text("hotspot_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceLabel: text("source_label").notNull(),
    evidenceFamily: text("evidence_family").notNull().default("search_discovery"),
    discoverySource: text("discovery_source").notNull().default("unknown"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    snippet: text("snippet").notNull().default(""),
    author: text("author"),
    publishedAt: text("published_at"),
    weight: integer("weight").notNull().default(1),
    qualityScore: integer("quality_score").notNull().default(0)
  },
  (table) => ({
    uniqueEvidence: uniqueIndex("hotspot_evidence_idx").on(table.hotspotId, table.candidateId)
  })
);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  hotspotId: text("hotspot_id"),
  channel: text("channel").notNull(),
  level: text("level").notNull(),
  status: text("status").notNull(),
  recipient: text("recipient"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: text("sent_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull()
});

export const scanRuns = sqliteTable("scan_runs", {
  id: text("id").primaryKey(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  summary: text("summary").notNull().default("{}"),
  errorMessage: text("error_message")
});
