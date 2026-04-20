import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardData } from "@/core/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await getDashboardData();
  return <DashboardShell initialData={dashboard} />;
}
