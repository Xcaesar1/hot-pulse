import { NextResponse } from "next/server";
import { sendTestNotification } from "@/core/notifications";

export const runtime = "nodejs";

export async function POST() {
  try {
    await sendTestNotification();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown notification error"
      },
      { status: 400 }
    );
  }
}
