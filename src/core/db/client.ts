import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getConfig } from "@/core/config";

type DbClient = ReturnType<typeof createClient>;
type DbInstance = ReturnType<typeof drizzle>;

declare global {
  var __hotPulseDb: { client: DbClient; db: DbInstance } | undefined;
  var __hotPulseBootstrapPromise: Promise<void> | undefined;
}

export function getDbBundle() {
  if (!globalThis.__hotPulseDb) {
    const config = getConfig();
    if (config.databaseUrl.startsWith("file:")) {
      const filePath = config.databaseUrl.replace(/^file:/, "");
      mkdirSync(dirname(filePath), { recursive: true });
    }
    const client = createClient({
      url: config.databaseUrl
    });
    globalThis.__hotPulseDb = { client, db: drizzle(client) };
  }
  return globalThis.__hotPulseDb;
}

export async function ensureBootstrap(bootstrap: () => Promise<void>) {
  if (!globalThis.__hotPulseBootstrapPromise) {
    globalThis.__hotPulseBootstrapPromise = bootstrap();
  }
  await globalThis.__hotPulseBootstrapPromise;
}
