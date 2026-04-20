import { NextResponse } from "next/server";
import { z } from "zod";
import { updateMonitor } from "@/core/db";

const patchSchema = z.object({
  label: z.string().optional(),
  query: z.string().optional(),
  mode: z.enum(["keyword", "topic"]).optional(),
  aliases: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  minRelevanceScore: z.number().min(0).max(100).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = patchSchema.parse(await request.json());
  await updateMonitor(id, payload);
  return NextResponse.json({ ok: true });
}
