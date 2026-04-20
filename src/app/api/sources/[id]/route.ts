import { NextResponse } from "next/server";
import { z } from "zod";
import { updateSource } from "@/core/db";

const patchSchema = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = patchSchema.parse(await request.json());
  await updateSource(id, payload);
  return NextResponse.json({ ok: true });
}
