import BondRegister from "../bond-register";
import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";

export const dynamic = "force-dynamic";
export default async function BondsPage() { const actor = await requireWorkspace("/bonds"); return <WorkspaceShell active="bonds" user={actor}><BondRegister /></WorkspaceShell>; }

