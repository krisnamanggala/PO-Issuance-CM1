import { getWorkspaceActor } from "@/app/lib/access";
import { createClient } from "@/app/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: RouteContext) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid bond." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("bond_history").select("id, action_type, previous_value, new_value, note, acted_by, acted_at").eq("bond_id", id).order("acted_at", { ascending: false });
  if (error) return Response.json({ error: "Bond history could not be loaded." }, { status: 500 });
  return Response.json({ history: data ?? [] });
}

