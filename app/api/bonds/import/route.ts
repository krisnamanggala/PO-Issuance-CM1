import { getWorkspaceActor } from "@/app/lib/access";
import { validateBondInput } from "@/app/lib/bonds";
import { createClient } from "@/app/lib/supabase/server";

const headers = ["po_number", "revision_number", "bond_type", "bond_number", "issuing_bank", "currency_code", "bond_value", "effective_date", "expiry_date", "remarks"] as const;

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { rows: [] as Record<string, string>[], errors: ["CSV is empty."] };
  const sourceHeaders = lines[0].split(",").map((value) => value.trim().replace(/^\uFEFF/, ""));
  const missing = headers.filter((header) => !sourceHeaders.includes(header));
  if (missing.length) return { rows: [] as Record<string, string>[], errors: [`Missing required columns: ${missing.join(", ")}.`] };
  return { rows: lines.slice(1).map((line) => Object.fromEntries(sourceHeaders.map((header, index) => [header, line.split(",")[index]?.trim() ?? ""]))), errors: [] as string[] };
}

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const formData = await request.formData(); const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a bond CSV file to import." }, { status: 400 });
    if (file.size > 2_000_000) return Response.json({ error: "CSV files must be 2 MB or smaller." }, { status: 400 });
    const parsed = parseCsv(await file.text());
    if (parsed.errors.length) return Response.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
    if (!parsed.rows.length) return Response.json({ error: "CSV has no bond rows to import." }, { status: 400 });
    const supabase = await createClient();
    const { data: poRows, error: poError } = await supabase.from("po_revisions").select("id, po_number, revision_number"); if (poError) throw poError;
    const poMap = new Map((poRows ?? []).map((po) => [`${po.po_number.toLowerCase()}::${po.revision_number}`, po.id]));
    const errors: string[] = []; const keys = new Set<string>();
    const entries = parsed.rows.map((row, index) => {
      const line = index + 2; const poRevisionId = poMap.get(`${row.po_number.toLowerCase()}::${row.revision_number}`);
      if (!poRevisionId) errors.push(`Row ${line}: PO No. ${row.po_number} revision ${row.revision_number} was not found.`);
      if (!row.bond_number) errors.push(`Row ${line}: Bond number is required for a safe CSV import.`);
      const input = { poRevisionId: poRevisionId ?? "", bondType: row.bond_type, bondNumber: row.bond_number, issuingBank: row.issuing_bank, currencyCode: row.currency_code || "IDR", bondValue: row.bond_value, expectedValue: "", effectiveDate: row.effective_date, expiryDate: row.expiry_date, remarks: row.remarks };
      const result = validateBondInput(input, actor.email); result.errors.forEach((message) => errors.push(`Row ${line}: ${message}`));
      const key = `${poRevisionId ?? "missing"}::${row.bond_type.toUpperCase()}::${row.bond_number.toLowerCase()}`; if (keys.has(key)) errors.push(`Row ${line}: Bond identity is duplicated within this CSV.`); keys.add(key);
      return result.value;
    });
    if (errors.length) return Response.json({ error: "Fix the CSV errors before importing.", errors }, { status: 400 });
    const { data: existing, error: existingError } = await supabase.from("bonds").select("po_revision_id, bond_type, bond_number").not("bond_number", "is", null); if (existingError) throw existingError;
    const existingKeys = new Set((existing ?? []).map((bond) => `${bond.po_revision_id}::${bond.bond_type}::${String(bond.bond_number).toLowerCase()}`));
    entries.forEach((entry, index) => { if (existingKeys.has(`${entry.po_revision_id}::${entry.bond_type}::${String(entry.bond_number).toLowerCase()}`)) errors.push(`Row ${index + 2}: This active bond identity already exists.`); });
    if (errors.length) return Response.json({ error: "No bonds were imported.", errors }, { status: 409 });
    const { data: inserted, error: insertError } = await supabase.from("bonds").insert(entries).select("id"); if (insertError) throw insertError;
    const { error: historyError } = await supabase.from("bond_history").insert((inserted ?? []).map((bond) => ({ bond_id: bond.id, action_type: "created", acted_by: actor.email, note: "Imported from bond CSV." }))); if (historyError) throw historyError;
    return Response.json({ imported: entries.length }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    return Response.json({ error: code === "23505" ? "No bonds were imported because an active bond identity already exists." : "The bond CSV could not be imported. Please try again." }, { status: 500 });
  }
}
