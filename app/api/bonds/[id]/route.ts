import { getWorkspaceActor } from "@/app/lib/access";
import { fromDatabaseBond, validateBondInput } from "@/app/lib/bonds";
import { createClient } from "@/app/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid bond." }, { status: 400 });
  try {
    const result = validateBondInput((await request.json()) as Record<string, unknown>, actor.email);
    if (result.errors.length) return Response.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 });
    const supabase = await createClient();
    const { data: previous, error: previousError } = await supabase.from("bonds").select().eq("id", id).single();
    if (previousError || !previous) return Response.json({ error: "Bond not found." }, { status: 404 });
    const { data, error } = await supabase.from("bonds").update({ ...result.value, updated_at: new Date().toISOString() }).eq("id", id).select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").single();
    if (error) throw error;
    const actionType = result.value.released_date ? "released" : result.value.expiry_date !== previous.expiry_date ? "extended" : "updated";
    await supabase.from("bond_history").insert({ bond_id: id, action_type: actionType, previous_value: previous, new_value: result.value, acted_by: actor.email });
    return Response.json({ record: fromDatabaseBond(data as never) });
  } catch {
    return Response.json({ error: "The bond could not be updated. Please try again." }, { status: 500 });
  }
}
