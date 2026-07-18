import { getAuthenticatedUser, getWorkspaceActor } from "./lib/access";
import POMonitor from "./po-monitor";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/sign-in?next=/");

  const actor = await getWorkspaceActor();
  if (!actor) redirect("/unauthorized");

  return (
    <POMonitor
      user={{ displayName: actor.displayName, email: actor.email }}
    />
  );
}
