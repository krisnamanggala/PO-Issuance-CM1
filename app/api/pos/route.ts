import { getWorkspaceActor } from "@/app/lib/access";
import { validatePOInput } from "@/app/lib/po";
import { fromDatabase, toInsertRecord } from "@/app/lib/po-db";
import { createClient } from "@/app/lib/supabase/server";

function errorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") {
    return "That PO No. and revision number already exist. Create a higher revision instead.";
  }
  return "The PO register could not be updated. Please try again.";
}

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("po_revisions")
      .select("*, projects(project_code, project_name)")
      .order("released_date", { ascending: false })
      .order("revision_number", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw error;
    return Response.json({ records: (data ?? []).map((record) => fromDatabase(record as never)) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const supabase = await createClient();
    const vendorId = Number(payload.vendorId);
    if (!Number.isInteger(vendorId) || vendorId < 1) return Response.json({ error: "Choose a vendor from master data." }, { status: 400 });
    const { data: vendor, error: vendorError } = await supabase.from("vendors").select("id, vendor_name, vendor_code").eq("id", vendorId).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor) return Response.json({ error: "The selected vendor is no longer available." }, { status: 400 });
    if (typeof vendor.vendor_code !== "string" || !vendor.vendor_code.trim()) return Response.json({ error: "The selected vendor needs a valid vendor code before it can be used." }, { status: 400 });
    const { value, errors } = validatePOInput({ ...payload, vendorId: vendor.id, vendorName: vendor.vendor_name }, actor.email);
    if (errors.length) return Response.json({ error: errors.join(" "), errors }, { status: 400 });

    if (value.previousRevisionId) {
      const { data: previous, error: previousError } = await supabase
        .from("po_revisions")
        .select("id, po_number, revision_number")
        .eq("id", value.previousRevisionId)
        .maybeSingle();
      if (previousError) throw previousError;
      if (!previous || previous.po_number !== value.poNumber || Number(previous.revision_number) >= value.revisionNumber) {
        return Response.json({ error: "The previous revision must belong to the same PO and have a lower revision number." }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("po_revisions")
      .insert(toInsertRecord(value))
      .select("*, projects(project_code, project_name)")
      .single();
    if (error) throw error;
    return Response.json({ record: fromDatabase(data as never) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
