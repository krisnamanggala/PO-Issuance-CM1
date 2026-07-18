import { getWorkspaceActor } from "@/app/lib/access";
import { csvRowToInput, parseCsv, validatePOInput } from "@/app/lib/po";
import { toInsertRecord } from "@/app/lib/po-db";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a CSV file to import." }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return Response.json({ error: "CSV files must be 2 MB or smaller." }, { status: 400 });
    }

    const parsed = parseCsv(await file.text());
    if (parsed.errors.length) {
      return Response.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
    }
    if (!parsed.rows.length) {
      return Response.json({ error: "CSV has no PO rows to import." }, { status: 400 });
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
    const entries = parsed.rows.map((row, index) => {
      const input = csvRowToInput(row);
      const projectCode = row.project_code?.trim();
      const vendorName = row.vendor_name?.trim() ?? "";
      if (projectCode) {
        const project = projects.get(projectCode.toLowerCase());
        if (!project) errors.push(`Row ${index + 2}: Project code ${projectCode} is not in master data.`);
        else input.projectId = String(project.id);
      }
      const vendor = vendors.get(vendorName.toLowerCase());
      if (!vendor) errors.push(`Row ${index + 2}: Vendor ${vendorName || "(blank)"} is not in master data.`);
      else if (typeof vendor.vendor_code !== "string" || !vendor.vendor_code.trim()) errors.push(`Row ${index + 2}: Vendor ${vendorName} needs a valid vendor code before it can be used.`);
      else input.vendorId = String(vendor.id);
      const result = validatePOInput(input, actor.email);
      result.errors.forEach((message) => errors.push(`Row ${index + 2}: ${message}`));
      return result.value;
    });
    const batchKeys = new Set<string>();
    entries.forEach((entry, index) => {
      const key = `${entry.poNumber.toLowerCase()}::${entry.revisionNumber}`;
      if (batchKeys.has(key)) errors.push(`Row ${index + 2}: PO No. and revision number repeat within this CSV.`);
      batchKeys.add(key);
    });
    if (errors.length) {
      return Response.json({ error: "Fix the CSV errors before importing.", errors }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("po_revisions")
      .select("po_number, revision_number");
    if (existingError) throw existingError;
    const existingKeys = new Set(
      (existing ?? []).map((entry) => `${entry.po_number.toLowerCase()}::${entry.revision_number}`),
    );
    entries.forEach((entry, index) => {
      if (existingKeys.has(`${entry.poNumber.toLowerCase()}::${entry.revisionNumber}`)) {
        errors.push(`Row ${index + 2}: PO No. ${entry.poNumber} revision ${entry.revisionNumber} already exists.`);
      }
    });
    if (errors.length) {
      return Response.json({ error: "No records were imported.", errors }, { status: 409 });
    }

    const { error: insertError } = await supabase
      .from("po_revisions")
      .insert(entries.map(toInsertRecord));
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
    return Response.json({ error: "The CSV could not be imported. Please try again." }, { status: 500 });
  }
}
