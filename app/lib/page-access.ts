import { redirect } from "next/navigation";
import { getAuthenticatedUser, getWorkspaceActor } from "./access";

export async function requireWorkspace(next: string) {
  const user = await getAuthenticatedUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const actor = await getWorkspaceActor(user);
  if (!actor) redirect("/unauthorized");
  return actor;
}

