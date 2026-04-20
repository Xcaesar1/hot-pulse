import { NextResponse } from "next/server";
import { listHotspots } from "@/core/db";
import { parseHotspotListQuery } from "@/core/hotspot-query";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseHotspotListQuery(url.searchParams, "dashboard");
  return NextResponse.json(await listHotspots(query, "dashboard"));
}
