import { NextResponse } from "next/server";
import { z } from "zod";
import { createMonitor, listMonitors } from "@/core/db";

const monitorSchema = z.object({
  label: z.string().min(1),
  query: z.string().min(1),
  mode: z.enum(["keyword", "topic"]),
  aliases: z.string().optional().default("")
});

export async function GET() {
  return NextResponse.json(await listMonitors());
}

export async function POST(request: Request) {
  const payload = monitorSchema.parse(await request.json());
  const monitor = await createMonitor({
    label: payload.label,
    query: payload.query,
    mode: payload.mode,
    aliases: payload.aliases
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    notifyEmail: true,
    notifyInApp: true,
    minRelevanceScore: 60
  });
  return NextResponse.json(monitor, { status: 201 });
}
