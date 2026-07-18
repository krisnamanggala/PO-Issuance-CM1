import { WorkspaceShell } from "../components/workspace-shell";
import ExecutionBoard from "../execution-board";
import { requireWorkspace } from "../lib/page-access";

export default async function ExecutionPage() {
  const actor = await requireWorkspace("/execution");
  return <WorkspaceShell active="execution" user={actor}><ExecutionBoard /></WorkspaceShell>;
}
