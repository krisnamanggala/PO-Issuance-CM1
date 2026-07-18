import { createClient } from "@/app/lib/supabase/server";

export type WorkspaceActor = {
  id: string;
  email: string;
  displayName: string;
};

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return data.user;
}

export async function getWorkspaceActor(): Promise<WorkspaceActor | null> {
  const user = await getAuthenticatedUser();
  if (!user?.email) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  const displayName =
    typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : user.email;
  return { id: user.id, email: user.email, displayName };
}
