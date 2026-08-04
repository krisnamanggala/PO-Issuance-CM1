import { WorkspaceShell } from "../components/workspace-shell";
import { requireWorkspace } from "../lib/page-access";
import VendorDirectory from "./vendor-directory";

export const dynamic = "force-dynamic";
export default async function VendorsPage() {
  const actor = await requireWorkspace("/vendors");
  return <WorkspaceShell active="vendors" user={actor}><VendorDirectory canEdit={actor.role !== "viewer"} /></WorkspaceShell>;
}
