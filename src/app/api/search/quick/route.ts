import { NextResponse } from "next/server";
import { z } from "zod";
import { runQuickSearch } from "@/core/quick-search";

export const runtime = "nodejs";

const quickSearchSchema = z.object({
  query: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const payload = quickSearchSchema.parse(await request.json());
    const result = await runQuickSearch(payload.query);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Quick search failed"
      },
      { status }
    );
  }
}
