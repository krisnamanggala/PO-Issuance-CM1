import { getWorkspaceActor } from "@/app/lib/access";
import { loadDashboardData } from "@/app/lib/dashboard-data";
import { criticalActions } from "@/app/lib/status";
import { createClient } from "@/app/lib/supabase/server";

type AlertUpdate = {
  sourceKey?: unknown;
  status?: unknown;
  note?: unknown;
  priority?: unknown;
  alertType?: unknown;
  poRevisionId?: unknown;
  bondId?: unknown;
  relevantDate?: unknown;
  daysRemaining?: unknown;
  assignedTo?: unknown;
  dueDate?: unknown;
  financialExposure?: unknown;
  currencyCode?: unknown;
};

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const [{ records, bonds, settings, deliveryUpdates }, alertsResult] = await Promise.all([
      loadDashboardData(),
      (await createClient()).from("alerts").select("*").order("created_at", { ascending: false }),
    ]);
    if (alertsResult.error) throw alertsResult.error;
    const stored = alertsResult.data ?? [];
    const bySource = new Map(stored.map((alert) => [alert.source_key, alert]));
    const derived = criticalActions(records, bonds, settings, new Date(), deliveryUpdates).map((action) => {
      const alert = bySource.get(action.id);
      return { ...action, sourceKey: action.id, alertId: alert?.id ?? null, alertStatus: alert?.alert_status ?? "open", note: alert?.note ?? "", assignedTo: alert?.assigned_to ?? "", dueDate: alert?.due_date ?? null, financialExposure: String(alert?.financial_exposure ?? action.financialExposure ?? action.value), createdAt: alert?.created_at ?? null, acknowledgedAt: alert?.acknowledged_at ?? null, resolvedAt: alert?.resolved_at ?? null };
    });
    const historical = stored.filter((alert) => !derived.some((entry) => entry.sourceKey === alert.source_key)).map((alert) => ({
      id: alert.source_key, sourceKey: alert.source_key, alertId: alert.id, priority: alert.priority, issueType: alert.alert_type, poNumber: "Historical alert", poRevisionId: alert.po_revision_id, vendorName: "—", projectCode: null, equipmentName: "", relevantDate: alert.relevant_date, daysRemaining: alert.days_remaining, currencyCode: alert.currency_code ?? "IDR", value: String(alert.financial_exposure ?? 0), financialExposure: String(alert.financial_exposure ?? 0), responsiblePerson: "", assignedTo: alert.assigned_to ?? "", dueDate: alert.due_date, bondId: alert.bond_id, alertStatus: alert.alert_status, note: alert.note, createdAt: alert.created_at, acknowledgedAt: alert.acknowledged_at, resolvedAt: alert.resolved_at,
    }));
    return Response.json({ alerts: [...derived, ...historical] });
  } catch {
    return Response.json({ error: "Alerts could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as AlertUpdate;
    const sourceKey = String(body.sourceKey ?? "").trim();
    const status = String(body.status ?? "").trim();
    if (!sourceKey || !["open", "acknowledged", "resolved"].includes(status)) return Response.json({ error: "A valid alert and status are required." }, { status: 400 });
    const supabase = await createClient();
    const { data: previous, error: lookupError } = await supabase.from("alerts").select("*").eq("source_key", sourceKey).maybeSingle();
    if (lookupError) throw lookupError;
    const now = new Date().toISOString();
    const note = String(body.note ?? previous?.note ?? "").trim().slice(0, 2000);
    const assignedTo = String(body.assignedTo ?? previous?.assigned_to ?? "").trim().slice(0, 200) || null;
    const dueDateRaw = String(body.dueDate ?? previous?.due_date ?? "").trim();
    if (dueDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)) return Response.json({ error: "Due date must use YYYY-MM-DD." }, { status: 400 });
    const update = { alert_status: status, note, assigned_to: assignedTo, due_date: dueDateRaw || null, acknowledged_at: status === "acknowledged" ? now : previous?.acknowledged_at ?? null, resolved_at: status === "resolved" ? now : status === "open" ? null : previous?.resolved_at ?? null, resolved_by: status === "resolved" ? actor.email : status === "open" ? null : previous?.resolved_by ?? null };
    let alert;
    if (previous) {
      const { data, error } = await supabase.from("alerts").update(update).eq("id", previous.id).select().single();
      if (error) throw error; alert = data;
    } else {
      const priority = String(body.priority ?? "medium");
      if (!["critical", "high", "medium"].includes(priority)) return Response.json({ error: "Invalid alert priority." }, { status: 400 });
      const exposure = Number(body.financialExposure);
      const currencyCode = String(body.currencyCode ?? "IDR").toUpperCase();
      const { data, error } = await supabase.from("alerts").insert({ source_key: sourceKey, po_revision_id: Number(body.poRevisionId) || null, bond_id: Number(body.bondId) || null, priority, alert_type: String(body.alertType ?? "Procurement exception").slice(0, 200), relevant_date: body.relevantDate ? String(body.relevantDate) : null, days_remaining: Number.isInteger(Number(body.daysRemaining)) ? Number(body.daysRemaining) : null, financial_exposure: Number.isFinite(exposure) && exposure >= 0 ? exposure : null, currency_code: currencyCode, created_by: actor.email, ...update }).select().single();
      if (error) throw error; alert = data;
    }
    const actionType = status === "acknowledged" ? "acknowledged" : status === "resolved" ? "resolved" : previous ? "updated" : "created";
    const { error: historyError } = await supabase.from("alert_history").insert({ alert_id: alert.id, action_type: actionType, previous_value: previous, new_value: alert, note, acted_by: actor.email });
    if (historyError) throw historyError;
    return Response.json({ alert });
  } catch {
    return Response.json({ error: "The alert could not be updated. Please try again." }, { status: 500 });
  }
}
