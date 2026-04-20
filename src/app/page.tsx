import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData } from "@/core/db";
import { parseHotspotListQuery } from "@/core/hotspot-query";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hotspotQuery = parseHotspotListQuery(resolvedSearchParams, "dashboard");
  const dashboard = await getDashboardData(hotspotQuery);
  return <DashboardShell initialData={dashboard} hotspotQuery={hotspotQuery} />;
}
