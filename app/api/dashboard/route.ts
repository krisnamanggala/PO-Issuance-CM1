import { getWorkspaceActor } from "@/app/lib/access";
import { loadDashboardData } from "@/app/lib/dashboard-data";
import { criticalActions, dashboardMetrics, dashboardVisuals } from "@/app/lib/status";

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { records, bonds, settings, deliveryUpdates, milestones, services } = await loadDashboardData();
    return Response.json({
      metrics: dashboardMetrics(records, bonds, settings, new Date(), deliveryUpdates, milestones, services),
      actions: criticalActions(records, bonds, settings, new Date(), deliveryUpdates),
      visuals: dashboardVisuals(records, bonds, settings, new Date(), deliveryUpdates),
      isEmpty: records.length === 0,
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "The dashboard could not be loaded. Please try again." }, { status: 500 });
  }
}
