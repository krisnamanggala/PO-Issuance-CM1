import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";
import MasterDataManager from "../master-data-manager";

export const dynamic = "force-dynamic";
export default async function MasterDataPage() { const actor = await requireWorkspace("/master-data"); return <WorkspaceShell active="master" user={actor}><MasterDataManager /></WorkspaceShell>; }

