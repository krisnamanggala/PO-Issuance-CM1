import { getWorkspaceActor, workspaceRoles } from "@/app/lib/access";
import { createClient } from "@/app/lib/supabase/server";

function isAdmin(role: string) { return role === "admin"; }

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isAdmin(actor.role)) return Response.json({ error: "Only workspace administrators can view and manage user roles." }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, email, role, created_at")
    .order("email");
  if (error) return Response.json({ error: "Workspace members could not be loaded." }, { status: 500 });
  return Response.json({ members: data ?? [] });
}

export async function PUT(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isAdmin(actor.role)) return Response.json({ error: "Only workspace administrators can manage user roles." }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  const userId = String(body.userId ?? "").trim();
  const role = String(body.role ?? "").trim();
  if (!userId || !(workspaceRoles as readonly string[]).includes(role)) {
    return Response.json({ error: "Choose a valid workspace member and role." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) return Response.json({ error: "Workspace member could not be found." }, { status: 500 });
  if (!member) return Response.json({ error: "Workspace member was not found." }, { status: 404 });
  if (member.role === "admin" && role !== "admin") {
    const { count, error: countError } = await supabase
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) return Response.json({ error: "Administrator roles could not be checked." }, { status: 500 });
    if ((count ?? 0) <= 1) return Response.json({ error: "At least one workspace administrator is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("user_id", userId)
    .select("user_id, email, role, created_at")
    .single();
  if (error) return Response.json({ error: "The workspace role could not be updated." }, { status: 500 });
  return Response.json({ member: data });
}
