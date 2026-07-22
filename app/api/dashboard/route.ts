import { getWorkspaceActor } from "@/app/lib/access";
import { loadDashboardData } from "@/app/lib/dashboard-data";
import { criticalActions, dashboardMetrics, dashboardVisuals, latestRevisions } from "@/app/lib/status";

export async function GET(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { records, bonds, settings, deliveryUpdates, milestones, services } = await loadDashboardData();
    const currentRecords = latestRevisions(records);
    const projects = [...new Set(currentRecords.map((record) => record.projectCode).filter((project): project is string => Boolean(project)))].sort();
    const requestedProject = new URL(request.url).searchParams.get("project")?.trim() ?? "";
    const selectedProject = projects.includes(requestedProject) ? requestedProject : null;
    const selectedPoNumbers = new Set(currentRecords.filter((record) => !selectedProject || record.projectCode === selectedProject).map((record) => record.poNumber));
    const scopedRecords = records.filter((record) => selectedPoNumbers.has(record.poNumber));
    return Response.json({
      metrics: dashboardMetrics(scopedRecords, bonds, settings, new Date(), deliveryUpdates, milestones, services),
      actions: criticalActions(scopedRecords, bonds, settings, new Date(), deliveryUpdates),
      visuals: dashboardVisuals(scopedRecords, bonds, settings, new Date(), deliveryUpdates),
      projects,
      selectedProject,
      isEmpty: records.length === 0,
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "The dashboard could not be loaded. Please try again." }, { status: 500 });
  }
}
