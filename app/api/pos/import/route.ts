import { canEditWorkspace, getWorkspaceActor } from "@/app/lib/access";
import { validatePOInput } from "@/app/lib/po";
import { parsePOExcel, rowToPOInput } from "@/app/lib/po-excel";
import { toInsertRecord } from "@/app/lib/po-db";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!canEditWorkspace(actor.role)) return Response.json({ error: "Viewer access is read-only." }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
      return Response.json({ error: "Choose a PO Register Excel template (.xlsx) to import." }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return Response.json({ error: "Excel files must be 2 MB or smaller." }, { status: 400 });
    }

    const parsed = await parsePOExcel(await file.arrayBuffer());
    if (parsed.errors.length) {
      return Response.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
    }
    if (!parsed.rows.length) {
      return Response.json({ error: "Excel file has no PO rows to import." }, { status: 400 });
    }

    const supabase = await createClient();
    const [projectsResult, vendorsResult] = await Promise.all([
      supabase.from("projects").select("id, project_code"),
      supabase.from("vendors").select("id, vendor_name, vendor_code"),
    ]);
    if (projectsResult.error || vendorsResult.error) throw projectsResult.error ?? vendorsResult.error;
    const projects = new Map((projectsResult.data ?? []).map((project) => [project.project_code.toLowerCase(), project]));
    const vendors = new Map((vendorsResult.data ?? []).map((vendor) => [vendor.vendor_name.toLowerCase(), vendor]));
    const errors: string[] = [];
    const entries = parsed.rows.map(({ values: row, rowNumber }) => {
      const input = rowToPOInput(row);
      const projectCode = row.project_code?.trim();
      const vendorName = row.vendor_name?.trim() ?? "";
      if (projectCode) {
        const project = projects.get(projectCode.toLowerCase());
        if (!project) errors.push(`Row ${rowNumber}: Project code ${projectCode} is not in master data.`);
        else input.projectId = String(project.id);
      }
      const vendor = vendors.get(vendorName.toLowerCase());
      if (!vendor) errors.push(`Row ${rowNumber}: Vendor ${vendorName || "(blank)"} is not in master data.`);
      else if (typeof vendor.vendor_code !== "string" || !vendor.vendor_code.trim()) errors.push(`Row ${rowNumber}: Vendor ${vendorName} needs a valid vendor code before it can be used.`);
      else input.vendorId = String(vendor.id);
      const result = validatePOInput(input, actor.email);
      result.errors.forEach((message) => errors.push(`Row ${rowNumber}: ${message}`));
      return { value: result.value, rowNumber };
    });
    const batchKeys = new Set<string>();
    entries.forEach((entry) => {
      const key = `${entry.value.poNumber.toLowerCase()}::${entry.value.revisionNumber}`;
      if (batchKeys.has(key)) errors.push(`Row ${entry.rowNumber}: PO No. and revision number repeat within this Excel file.`);
      batchKeys.add(key);
    });
    if (errors.length) {
      return Response.json({ error: "Fix the Excel errors before importing.", errors }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("po_revisions")
      .select("po_number, revision_number");
    if (existingError) throw existingError;
    const existingKeys = new Set(
      (existing ?? []).map((entry) => `${entry.po_number.toLowerCase()}::${entry.revision_number}`),
    );
    entries.forEach((entry) => {
      if (existingKeys.has(`${entry.value.poNumber.toLowerCase()}::${entry.value.revisionNumber}`)) {
        errors.push(`Row ${entry.rowNumber}: PO No. ${entry.value.poNumber} revision ${entry.value.revisionNumber} already exists.`);
      }
    });
    if (errors.length) {
      return Response.json({ error: "No records were imported.", errors }, { status: 409 });
    }

    const { error: insertError } = await supabase
      .from("po_revisions")
      .insert(entries.map((entry) => toInsertRecord(entry.value)));
    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json(
          { error: "No records were imported because a PO No. and revision number already exist." },
          { status: 409 },
        );
      }
      throw insertError;
    }
    return Response.json({ imported: entries.length }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return Response.json(
        { error: "No records were imported because a PO No. and revision number already exist." },
        { status: 409 },
      );
    }
    return Response.json({ error: "The Excel file could not be imported. Please try again." }, { status: 500 });
  }
}
