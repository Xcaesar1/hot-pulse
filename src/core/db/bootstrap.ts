import { eq, sql } from "drizzle-orm";
import { defaultMonitors, defaultSources } from "@/core/defaults";
import { getDbBundle } from "@/core/db/client";
import { monitors, sources } from "@/core/db/schema";
import { nowIso, safeJsonParse, toJson } from "@/core/utils";

async function createTables() {
  const { client } = getDbBundle();
  const statements = [
    `CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      query TEXT NOT NULL,
      mode TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      check_interval_minutes INTEGER NOT NULL DEFAULT 30,
      min_relevance_score INTEGER NOT NULL DEFAULT 60,
      notify_email INTEGER NOT NULL DEFAULT 0,
      notify_in_app INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL DEFAULT '{}',
      last_status TEXT NOT NULL DEFAULT 'idle',
      last_run_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS candidate_documents (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      snippet TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      author TEXT,
      published_at TEXT,
      hash TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_id, external_id)
    )`,
    `CREATE TABLE IF NOT EXISTS hotspots (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      notify_level TEXT NOT NULL DEFAULT 'low',
      relevance_score INTEGER NOT NULL DEFAULT 0,
      credibility_risk INTEGER NOT NULL DEFAULT 100,
      novelty_score INTEGER NOT NULL DEFAULT 0,
      source_diversity_score INTEGER NOT NULL DEFAULT 0,
      source_authority_score INTEGER NOT NULL DEFAULT 0,
      source_reliability_score INTEGER NOT NULL DEFAULT 0,
      velocity_score INTEGER NOT NULL DEFAULT 0,
      final_score INTEGER NOT NULL DEFAULT 0,
      evidence_count INTEGER NOT NULL DEFAULT 0,
      notified INTEGER NOT NULL DEFAULT 0,
      monitor_labels TEXT NOT NULL DEFAULT '[]',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS hotspot_evidences (
      id TEXT PRIMARY KEY,
      hotspot_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_label TEXT NOT NULL,
      evidence_family TEXT NOT NULL DEFAULT 'search_discovery',
      discovery_source TEXT NOT NULL DEFAULT 'unknown',
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT NOT NULL DEFAULT '',
      author TEXT,
      published_at TEXT,
      weight INTEGER NOT NULL DEFAULT 1,
      quality_score INTEGER NOT NULL DEFAULT 0,
      UNIQUE(hotspot_id, candidate_id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      hotspot_id TEXT,
      channel TEXT NOT NULL,
      level TEXT NOT NULL,
      status TEXT NOT NULL,
      recipient TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS scan_runs (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      summary TEXT NOT NULL DEFAULT '{}',
      error_message TEXT
    )`
  ];

  for (const statement of statements) {
    await client.execute(statement);
  }

  const alterStatements = [
    `ALTER TABLE hotspots ADD COLUMN source_reliability_score INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE hotspot_evidences ADD COLUMN evidence_family TEXT NOT NULL DEFAULT 'search_discovery'`,
    `ALTER TABLE hotspot_evidences ADD COLUMN discovery_source TEXT NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE hotspot_evidences ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 0`
  ];

  for (const statement of alterStatements) {
    try {
      await client.execute(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("duplicate column")) {
        throw error;
      }
    }
  }
}

async function seedDefaults() {
  const { db } = getDbBundle();
  const existingMonitors = await db.select({ count: sql<number>`count(*)` }).from(monitors);
  const existingSources = await db.select({ count: sql<number>`count(*)` }).from(sources);
  const defaultSourceMap = new Map(defaultSources().map((item) => [item.key, item]));

  if ((existingMonitors[0]?.count ?? 0) === 0) {
    await db.insert(monitors).values(
      defaultMonitors().map((item) => ({
        id: item.id,
        label: item.label,
        query: item.query,
        mode: item.mode,
        aliases: toJson(item.aliases),
        checkIntervalMinutes: item.checkIntervalMinutes,
        minRelevanceScore: item.minRelevanceScore,
        notifyEmail: item.notifyEmail,
        notifyInApp: item.notifyInApp,
        enabled: item.enabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    );
  }

  if ((existingSources[0]?.count ?? 0) === 0) {
    await db.insert(sources).values(
      defaultSources().map((item) => ({
        id: item.id,
        key: item.key,
        label: item.label,
        kind: item.kind,
        enabled: item.enabled,
        config: toJson(item.config),
        lastStatus: item.lastStatus,
        lastRunAt: item.lastRunAt,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    );
  } else {
    const sourceRows = await db.select().from(sources);
    const existingKeys = new Set(sourceRows.map((row) => row.key));
    for (const row of sourceRows) {
      const defaultSource = defaultSourceMap.get(row.key);
      if (!defaultSource) continue;

      const currentConfig = safeJsonParse<Record<string, unknown>>(row.config, {});

      const shouldRepairCustomRss =
        row.key === "custom-rss" &&
        Array.isArray(currentConfig.feedUrls) &&
        currentConfig.feedUrls.some((value) => String(value).includes("anthropic.com/news/rss.xml"));

      const shouldRepairTwitter =
        row.key === "twitter-api" &&
        (!("userFetchLimit" in currentConfig) ||
          !("backoffMs" in currentConfig) ||
          !("minLikes" in currentConfig) ||
          !("minRetweets" in currentConfig) ||
          !("minViews" in currentConfig) ||
          !("minFollowers" in currentConfig) ||
          !("strictMode" in currentConfig) ||
          !("queryType" in currentConfig) ||
          String(currentConfig.usernames ?? "").includes("vercel"));

      const shouldRepairSearchSizing =
        (row.key === "duckduckgo-search" && Number(currentConfig.maxResults ?? 0) <= 4) ||
        (row.key === "google-news-rss" && Number(currentConfig.maxResults ?? 0) <= 6) ||
        ((row.key === "startpage-search" || row.key === "brave-search") && Number(currentConfig.maxResults ?? 0) <= 0);

      if (shouldRepairCustomRss || shouldRepairTwitter || shouldRepairSearchSizing) {
        await db
          .update(sources)
          .set({
            config: toJson(defaultSource.config),
            updatedAt: nowIso()
          })
          .where(eq(sources.id, row.id));
      }
    }

    for (const source of defaultSources()) {
      if (!existingKeys.has(source.key)) {
        await db.insert(sources).values({
          id: source.id,
          key: source.key,
          label: source.label,
          kind: source.kind,
          enabled: source.enabled,
          config: toJson(source.config),
          lastStatus: source.lastStatus,
          lastRunAt: source.lastRunAt,
          errorMessage: source.errorMessage,
          createdAt: source.createdAt,
          updatedAt: source.updatedAt
        });
      }
    }
  }
}

export async function bootstrapDatabase() {
  await createTables();
  await seedDefaults();
}
