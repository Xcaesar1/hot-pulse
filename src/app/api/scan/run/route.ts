import { NextResponse } from "next/server";
import { runScanCycle } from "@/core/orchestrator";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runScanCycle("api");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scan error"
      },
      { status: 500 }
    );
  }
}
