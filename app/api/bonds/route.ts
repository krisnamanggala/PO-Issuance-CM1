import { getWorkspaceActor } from "@/app/lib/access";
import { fromDatabaseBond, validateBondInput } from "@/app/lib/bonds";
import { createClient } from "@/app/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Auto-generate a unique bond number consolidated from the PO No. and the
// vendor code (with the bond type to keep PB/WB distinct), adding a numeric
// suffix only when a collision would otherwise occur.
async function generateBondNumber(supabase: SupabaseServerClient, poRevisionId: number, bondType: string) {
  const { data: po } = await supabase.from("po_revisions").select("po_number, vendor_id").eq("id", poRevisionId).maybeSingle();
  if (!po) return null;
  let vendorCode = "";
  if (po.vendor_id) {
    const { data: vendor } = await supabase.from("vendors").select("vendor_code").eq("id", po.vendor_id).maybeSingle();
    vendorCode = String(vendor?.vendor_code ?? "").trim();
  }
  const base = [po.po_number, vendorCode, bondType].filter((part) => String(part ?? "").trim()).join("-");
  let candidate = base;
  let suffix = 1;
  // The unique index on bond_number is the ultimate guard; this keeps the value tidy.
  while (true) {
    const { data: clash } = await supabase.from("bonds").select("id").eq("bond_number", candidate).maybeSingle();
    if (!clash) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

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
    const bondNumber = await generateBondNumber(supabase, result.value.po_revision_id, result.value.bond_type);
    if (!bondNumber) return Response.json({ error: "The selected PO revision is no longer available." }, { status: 400 });
    const insertValue = { ...result.value, bond_number: bondNumber };
    const { data, error } = await supabase.from("bonds").insert(insertValue).select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").single();
    if (error) throw error;
    await supabase.from("bond_history").insert({ bond_id: data.id, action_type: "created", new_value: insertValue, acted_by: actor.email });
    return Response.json({ record: fromDatabaseBond(data as never) }, { status: 201 });
  } catch {
    return Response.json({ error: "The bond could not be saved. Please try again." }, { status: 500 });
  }
}
