import { NextResponse } from "next/server";
import { listHotspots } from "@/core/db";

export async function GET() {
  return NextResponse.json(await listHotspots());
}
