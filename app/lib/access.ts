import { createClient } from "@/app/lib/supabase/server";

export const workspaceRoles = ["admin", "editor", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export type WorkspaceActor = {
  id: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
};

export function canEditWorkspace(role: WorkspaceRole) {
  return role === "admin" || role === "editor";
}

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return data.user;
}

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;

export async function getWorkspaceActor(existingUser?: AuthenticatedUser): Promise<WorkspaceActor | null> {
  const user = existingUser ?? (await getAuthenticatedUser());
  if (!user?.email) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  const displayName =
    typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : user.email;
  const role = (workspaceRoles as readonly string[]).includes(data.role) ? data.role as WorkspaceRole : "editor";
  return { id: user.id, email: user.email, displayName, role };
}
