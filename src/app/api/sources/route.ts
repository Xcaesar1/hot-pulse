import { NextResponse } from "next/server";
import { listSources } from "@/core/db";

export async function GET() {
  return NextResponse.json(await listSources());
}
