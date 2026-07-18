import DashboardOverview from "./dashboard-overview";
import { WorkspaceShell } from "./components/workspace-shell";
import { requireWorkspace } from "./lib/page-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await requireWorkspace("/");
  return <WorkspaceShell active="overview" user={actor}><DashboardOverview /></WorkspaceShell>;
}
