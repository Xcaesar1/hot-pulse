import { DashboardShell } from "@/components/dashboard-shell";
import type { DashboardView } from "@/core/contracts";
import { getDashboardData } from "@/core/db";
import { parseHotspotListQuery } from "@/core/hotspot-query";

export const dynamic = "force-dynamic";

function parseDashboardView(input: string | string[] | undefined): DashboardView {
  const value = Array.isArray(input) ? input[0] : input;
  return value === "monitors" || value === "search" ? value : "radar";
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hotspotQuery = parseHotspotListQuery(resolvedSearchParams, "dashboard");
  const initialView = parseDashboardView(resolvedSearchParams.view);
  const dashboard = await getDashboardData(hotspotQuery);
  return <DashboardShell initialData={dashboard} hotspotQuery={hotspotQuery} initialView={initialView} />;
}
