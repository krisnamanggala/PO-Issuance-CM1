import AlertsBoard from "../alerts-board";
import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";

export const dynamic = "force-dynamic";
export default async function AlertsPage() { const actor = await requireWorkspace("/alerts"); return <WorkspaceShell active="alerts" user={actor}><AlertsBoard /></WorkspaceShell>; }

