import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";
import SettingsPanel from "../settings-panel";

export const dynamic = "force-dynamic";
export default async function SettingsPage() { const actor = await requireWorkspace("/settings"); return <WorkspaceShell active="settings" user={actor}><SettingsPanel /></WorkspaceShell>; }

