import { getWorkspaceActor } from "@/app/lib/access";
import { fromDatabaseBond, validateBondInput } from "@/app/lib/bonds";
import { createClient } from "@/app/lib/supabase/server";

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonds")
    .select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))")
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) return Response.json({ error: "The bond register could not be loaded." }, { status: 500 });
  return Response.json({ records: (data ?? []).map((record) => fromDatabaseBond(record as never)) });
}

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const result = validateBondInput((await request.json()) as Record<string, unknown>, actor.email);
    if (result.errors.length) return Response.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase.from("bonds").insert(result.value).select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").single();
    if (error) throw error;
    await supabase.from("bond_history").insert({ bond_id: data.id, action_type: "created", new_value: result.value, acted_by: actor.email });
    return Response.json({ record: fromDatabaseBond(data as never) }, { status: 201 });
  } catch {
    return Response.json({ error: "The bond could not be saved. Please try again." }, { status: 500 });
  }
}
