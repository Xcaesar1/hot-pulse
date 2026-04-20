import fs from "node:fs";
import path from "node:path";
import { looksLikeUrl } from "@/core/utils";

if (typeof process.loadEnvFile === "function") {
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), filename);
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

export interface AppConfig {
  databaseUrl: string;
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterBaseUrl: string;
  openRouterSiteUrl: string;
  openRouterSiteName: string;
  twitterApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  alertEmailTo: string;
  defaultCheckIntervalMinutes: number;
  sourceAllowlist: string[];
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  cachedConfig = {
    databaseUrl: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "hot-pulse.db")}`,
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-5.2",
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    openRouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    openRouterSiteName: process.env.OPENROUTER_SITE_NAME ?? "Hot Pulse",
    twitterApiKey: process.env.TWITTERAPI_IO_KEY ?? "",
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? "587"),
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFrom: process.env.SMTP_FROM ?? "hot-pulse@example.com",
    alertEmailTo: process.env.ALERT_EMAIL_TO ?? "",
    defaultCheckIntervalMinutes: 30,
    sourceAllowlist: (process.env.SOURCE_FETCH_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  };

  return cachedConfig;
}

export function getEnvFlags() {
  const config = getConfig();
  return {
    hasOpenRouter: Boolean(config.openRouterApiKey),
    hasTwitterApi: Boolean(config.twitterApiKey),
    hasEmail: Boolean(
      config.smtpHost &&
        !looksLikeUrl(config.smtpHost) &&
        config.smtpUser &&
        config.smtpPass &&
        config.alertEmailTo
    )
  };
}
