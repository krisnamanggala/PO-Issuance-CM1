import { getWorkspaceActor } from "@/app/lib/access";
import { createClient } from "@/app/lib/supabase/server";

function isAdmin(role: string) { return role === "admin"; }

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const supabase = await createClient();
    const [projects, vendors, settings] = await Promise.all([
      supabase.from("projects").select("id, project_code, project_name, is_active, updated_at").order("project_code"),
      supabase.from("vendors").select("id, vendor_name, vendor_code, is_active, updated_at").order("vendor_name"),
      supabase.from("workspace_settings").select("delivery_warning_days, bond_critical_days, bond_warning_days, updated_at").eq("id", 1).maybeSingle(),
    ]);
    if (projects.error || vendors.error || settings.error) throw projects.error ?? vendors.error ?? settings.error;
    return Response.json({ projects: projects.data ?? [], vendors: vendors.data ?? [], settings: settings.data, permissions: { isAdmin: isAdmin(actor.role) } });
  } catch {
    return Response.json({ error: "Master data could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isAdmin(actor.role)) return Response.json({ error: "Only workspace administrators can manage master data." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = String(body.kind ?? ""); const supabase = await createClient();
    if (kind === "project") {
      const projectCode = String(body.projectCode ?? "").trim().toUpperCase(); const projectName = String(body.projectName ?? "").trim();
      if (!projectCode) return Response.json({ error: "Project code is required." }, { status: 400 });
      const { data, error } = await supabase.from("projects").insert({ project_code: projectCode, project_name: projectName, created_by: actor.email, updated_by: actor.email }).select().single(); if (error) throw error; return Response.json({ record: data }, { status: 201 });
    }
    if (kind === "vendor") {
      const vendorName = String(body.vendorName ?? "").trim(); const vendorCode = String(body.vendorCode ?? "").trim().toUpperCase();
      if (!vendorName) return Response.json({ error: "Vendor name is required." }, { status: 400 });
      if (!vendorCode) return Response.json({ error: "Vendor code is required." }, { status: 400 });
      const { data, error } = await supabase.from("vendors").insert({ vendor_name: vendorName, vendor_code: vendorCode, created_by: actor.email, updated_by: actor.email }).select().single(); if (error) throw error; return Response.json({ record: data }, { status: 201 });
    }
    return Response.json({ error: "Unsupported master-data item." }, { status: 400 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    return Response.json({ error: code === "23505" ? "That master-data value already exists." : "The master-data item could not be saved." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isAdmin(actor.role)) return Response.json({ error: "Only workspace administrators can manage master data and settings." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>; const kind = String(body.kind ?? ""); const supabase = await createClient();
    if (kind === "settings") {
      const deliveryWarningDays = Number(body.deliveryWarningDays); const bondCriticalDays = Number(body.bondCriticalDays); const bondWarningDays = Number(body.bondWarningDays);
      if (![deliveryWarningDays, bondCriticalDays, bondWarningDays].every((value) => Number.isInteger(value) && value >= 1 && value <= 365)) return Response.json({ error: "Thresholds must be whole numbers from 1 to 365." }, { status: 400 });
      const { error } = await supabase.from("workspace_settings").update({ delivery_warning_days: deliveryWarningDays, bond_critical_days: bondCriticalDays, bond_warning_days: bondWarningDays, updated_by: actor.email, updated_at: new Date().toISOString() }).eq("id", 1); if (error) throw error; return Response.json({ ok: true });
    }
    const id = Number(body.id); if (!Number.isInteger(id)) return Response.json({ error: "Invalid master-data item." }, { status: 400 });
    if (kind === "project") { const { error } = await supabase.from("projects").update({ is_active: Boolean(body.isActive), updated_by: actor.email, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; return Response.json({ ok: true }); }
    if (kind === "vendor") { const { error } = await supabase.from("vendors").update({ is_active: Boolean(body.isActive), updated_by: actor.email, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error; return Response.json({ ok: true }); }
    return Response.json({ error: "Unsupported master-data item." }, { status: 400 });
  } catch { return Response.json({ error: "The update could not be saved." }, { status: 500 }); }
}
