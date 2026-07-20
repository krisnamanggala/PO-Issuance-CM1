import { getWorkspaceActor } from "@/app/lib/access";
import {
  fromDatabaseDelivery, fromDatabaseMilestone, fromDatabaseService,
  validateDeliveryUpdate, validatePaymentMilestone,
} from "@/app/lib/execution";
import { createClient } from "@/app/lib/supabase/server";

const poContext = "po_revisions(po_number, revision_number, vendor_name, equipment_name, contract_value, currency_code, projects(project_code))";

function message(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") return "That milestone sequence already exists for this PO revision.";
  return "Execution data could not be saved. Please try again.";
}

export async function GET() {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const supabase = await createClient();
    const [delivery, milestones, services] = await Promise.all([
      supabase.from("delivery_updates").select(`*, ${poContext}`).order("update_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("payment_milestones").select(`*, ${poContext}`).order("planned_payment_date", { ascending: true }).order("sequence_no", { ascending: true }),
      supabase.from("po_services").select("*").order("po_revision_id", { ascending: false }),
    ]);
    if (delivery.error) throw delivery.error;
    if (milestones.error) throw milestones.error;
    if (services.error) throw services.error;
    return Response.json({
      deliveryUpdates: (delivery.data ?? []).map((item) => fromDatabaseDelivery(item as never)),
      milestones: (milestones.data ?? []).map((item) => fromDatabaseMilestone(item as never)),
      services: (services.data ?? []).map((item) => fromDatabaseService(item as never)),
    });
  } catch {
    return Response.json({ error: "Execution data could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const source = await request.json() as Record<string, unknown>;
    const kind = String(source.kind ?? "");
    const validation = kind === "delivery-update"
      ? validateDeliveryUpdate(source, actor.email)
      : kind === "payment-milestone"
        ? validatePaymentMilestone(source, actor.email)
        : null;
    if (!validation) return Response.json({ error: "Choose a valid execution record type." }, { status: 400 });
    if (validation.errors.length) return Response.json({ error: validation.errors.join(" "), errors: validation.errors }, { status: 400 });
    const supabase = await createClient();
    const poRevisionId = Number(validation.value.po_revision_id);
    const { data: po, error: poError } = await supabase.from("po_revisions").select("id").eq("id", poRevisionId).maybeSingle();
    if (poError) throw poError;
    if (!po) return Response.json({ error: "The selected PO revision is no longer available." }, { status: 400 });
    const table = kind === "delivery-update" ? "delivery_updates" : "payment_milestones";
    const { data, error } = await supabase.from(table).insert(validation.value).select(`*, ${poContext}`).single();
    if (error) throw error;
    return Response.json({
      record: kind === "delivery-update" ? fromDatabaseDelivery(data as never) : fromDatabaseMilestone(data as never),
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const actor = await getWorkspaceActor();
  if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const source = await request.json() as Record<string, unknown>;
    const id = Number(source.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Choose a valid payment milestone." }, { status: 400 });
    const supabase = await createClient();
    const { data: existing, error: lookupError } = await supabase.from("payment_milestones").select("*").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return Response.json({ error: "The payment milestone no longer exists." }, { status: 404 });
    const merged = {
      poRevisionId: existing.po_revision_id, sequenceNo: existing.sequence_no, milestoneName: existing.milestone_name,
      percentage: existing.percentage, amount: existing.amount, currencyCode: existing.currency_code,
      dueDateDays: source.dueDateDays ?? existing.due_date_days,
      plannedInvoiceDate: source.plannedInvoiceDate ?? existing.planned_invoice_date,
      plannedPaymentDate: source.plannedPaymentDate ?? existing.planned_payment_date,
      actualPaymentDate: source.actualPaymentDate ?? existing.actual_payment_date,
      milestoneStatus: source.milestoneStatus ?? existing.milestone_status,
      remarks: source.remarks ?? existing.remarks,
    };
    const { value, errors } = validatePaymentMilestone(merged, actor.email);
    if (errors.length) return Response.json({ error: errors.join(" "), errors }, { status: 400 });
    const update = { ...value };
    delete (update as { created_by?: string }).created_by;
    const { data, error } = await supabase.from("payment_milestones").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id).select(`*, ${poContext}`).single();
    if (error) throw error;
    return Response.json({ record: fromDatabaseMilestone(data as never) });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
