import nodemailer from "nodemailer";
import { getConfig, getEnvFlags } from "@/core/config";
import { createNotification, markHotspotNotified } from "@/core/db";
import type { HotspotView, NotificationLevel } from "@/core/contracts";
import { looksLikeUrl, nowIso } from "@/core/utils";

function getValidatedSmtpHost(rawHost: string) {
  const host = rawHost.trim();
  if (!host) {
    throw new Error("SMTP_HOST is missing");
  }
  if (looksLikeUrl(host)) {
    throw new Error(`SMTP_HOST must be a hostname like smtp.163.com, but received a URL: ${host}`);
  }
  if (host.includes("/") || host.includes("?")) {
    throw new Error(`SMTP_HOST must not include paths or query strings: ${host}`);
  }
  return host;
}

function createMailTransport() {
  const config = getConfig();
  return nodemailer.createTransport({
    host: getValidatedSmtpHost(config.smtpHost),
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });
}

function buildMessage(hotspot: HotspotView) {
  return {
    subject: `[Hot Pulse][${hotspot.notifyLevel.toUpperCase()}] ${hotspot.title}`,
    body: [
      hotspot.summary,
      "",
      `Final Score: ${hotspot.finalScore}`,
      `Relevance: ${hotspot.relevanceScore}`,
      `Credibility Risk: ${hotspot.credibilityRisk}`,
      `Sources: ${hotspot.evidence.map((item) => item.sourceLabel).join(", ")}`,
      `URL: ${hotspot.canonicalUrl}`
    ].join("\n")
  };
}

export async function dispatchHotspotNotifications(hotspot: HotspotView): Promise<number> {
  const message = buildMessage(hotspot);
  let sentCount = 0;

  await createNotification({
    hotspotId: hotspot.id,
    channel: "inbox",
    level: hotspot.notifyLevel,
    status: "sent",
    recipient: null,
    subject: message.subject,
    body: message.body,
    sentAt: nowIso(),
    errorMessage: null
  });
  sentCount += 1;

  const flags = getEnvFlags();
  if (hotspot.notifyLevel === "high" && flags.hasEmail) {
    const config = getConfig();
    const transport = createMailTransport();

    try {
      await transport.sendMail({
        from: config.smtpFrom,
        to: config.alertEmailTo,
        subject: message.subject,
        text: message.body
      });
      await createNotification({
        hotspotId: hotspot.id,
        channel: "email",
        level: hotspot.notifyLevel,
        status: "sent",
        recipient: config.alertEmailTo,
        subject: message.subject,
        body: message.body,
        sentAt: nowIso(),
        errorMessage: null
      });
      sentCount += 1;
    } catch (error) {
      await createNotification({
        hotspotId: hotspot.id,
        channel: "email",
        level: hotspot.notifyLevel,
        status: "failed",
        recipient: config.alertEmailTo,
        subject: message.subject,
        body: message.body,
        sentAt: null,
        errorMessage: error instanceof Error ? error.message : "Unknown mail error"
      });
    }
  } else if (hotspot.notifyLevel === "high") {
    await createNotification({
      hotspotId: hotspot.id,
      channel: "email",
      level: hotspot.notifyLevel,
      status: "skipped",
      recipient: null,
      subject: message.subject,
      body: message.body,
      sentAt: null,
      errorMessage: "Email is not configured"
    });
  }

  await markHotspotNotified(hotspot.id);
  return sentCount;
}

export async function sendTestNotification(level: NotificationLevel = "medium") {
  const config = getConfig();
  const flags = getEnvFlags();
  const subject = `[Hot Pulse][${level.toUpperCase()}] Test notification`;
  const body = "This is a test notification from Hot Pulse.";

  if (!flags.hasEmail) {
    if (config.smtpHost && looksLikeUrl(config.smtpHost)) {
      throw new Error(`SMTP_HOST must be smtp.163.com style hostname, but received URL: ${config.smtpHost}`);
    }
    throw new Error("Email is not configured");
  }

  const transport = createMailTransport();
  await transport.verify();

  await transport.sendMail({
    from: config.smtpFrom,
    to: config.alertEmailTo,
    subject,
    text: body
  });

  await createNotification({
    hotspotId: null,
    channel: "email",
    level,
    status: "sent",
    recipient: config.alertEmailTo,
    subject,
    body,
    sentAt: nowIso(),
    errorMessage: null
  });
}
