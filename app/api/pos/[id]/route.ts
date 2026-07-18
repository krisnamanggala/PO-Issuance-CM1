import { getWorkspaceActor } from "@/app/lib/access";
import { validatePOInput } from "@/app/lib/po";
import { fromDatabase, toUpdateRecord } from "@/app/lib/po-db";
import { createClient } from "@/app/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

function errorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") {
    return "That PO No. and revision number already exist.";
  }
  return "The PO revision could not be updated. Please try again.";
}

export async function PUT(request: Request, context: RouteContext) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const id = Number.parseInt((await context.params).id, 10);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid PO revision." }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("po_revisions")
      .select("po_number, revision_number")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return Response.json({ error: "PO revision not found." }, { status: 404 });

    const payload = (await request.json()) as Record<string, unknown>;
    const { value, errors } = validatePOInput(payload, actor.email);
    if (errors.length) return Response.json({ error: errors.join(" "), errors }, { status: 400 });
    if (
      value.poNumber !== existing.po_number ||
      value.revisionNumber !== existing.revision_number
    ) {
      return Response.json(
        { error: "PO No. and revision number are fixed for an existing record. Create a new revision instead." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("po_revisions")
      .update(toUpdateRecord(value))
      .eq("id", id)
      .select("*, projects(project_code, project_name)")
      .single();
    if (error) throw error;
    return Response.json({ record: fromDatabase(data as never) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
