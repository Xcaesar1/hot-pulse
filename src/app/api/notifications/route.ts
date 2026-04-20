import { NextResponse } from "next/server";
import { listNotifications } from "@/core/db";

export async function GET() {
  return NextResponse.json(await listNotifications());
}
