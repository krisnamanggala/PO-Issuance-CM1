import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";
import POMonitor from "../po-monitor";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const actor = await requireWorkspace("/register");
  return <WorkspaceShell active="register" user={actor}><POMonitor user={{ displayName: actor.displayName, email: actor.email }} embedded /></WorkspaceShell>;
}
