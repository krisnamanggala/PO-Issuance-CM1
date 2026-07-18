import { fromDatabaseBond } from "./bonds";
import { fromDatabaseDelivery, fromDatabaseMilestone, fromDatabaseService } from "./execution";
import { fromDatabase } from "./po-db";
import { defaultDashboardSettings, type DashboardSettings } from "./status";
import { createClient } from "./supabase/server";

export async function loadDashboardData() {
  const supabase = await createClient();
  const [posResult, bondsResult, settingsResult, deliveryResult, milestoneResult, serviceResult] = await Promise.all([
    supabase.from("po_revisions").select("*, projects(project_code, project_name)").order("released_date", { ascending: false }).order("revision_number", { ascending: false }),
    supabase.from("bonds").select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").order("updated_at", { ascending: false }),
    supabase.from("workspace_settings").select("delivery_warning_days, bond_critical_days, bond_warning_days").eq("id", 1).maybeSingle(),
    supabase.from("delivery_updates").select("*, po_revisions(po_number, revision_number, vendor_name, equipment_name, contract_value, currency_code, projects(project_code))").order("update_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("payment_milestones").select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").order("planned_payment_date", { ascending: true }),
    supabase.from("po_services").select("*"),
  ]);
  if (posResult.error) throw posResult.error;
  if (bondsResult.error) throw bondsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (deliveryResult.error) throw deliveryResult.error;
  if (milestoneResult.error) throw milestoneResult.error;
  if (serviceResult.error) throw serviceResult.error;
  const settings: DashboardSettings = settingsResult.data ? {
    deliveryWarningDays: settingsResult.data.delivery_warning_days,
    bondCriticalDays: settingsResult.data.bond_critical_days,
    bondWarningDays: settingsResult.data.bond_warning_days,
  } : defaultDashboardSettings;
  return {
    records: (posResult.data ?? []).map((record) => fromDatabase(record as never)),
    bonds: (bondsResult.data ?? []).map((record) => fromDatabaseBond(record as never)),
    deliveryUpdates: (deliveryResult.data ?? []).map((record) => fromDatabaseDelivery(record as never)),
    milestones: (milestoneResult.data ?? []).map((record) => fromDatabaseMilestone(record as never)),
    services: (serviceResult.data ?? []).map((record) => fromDatabaseService(record as never)),
    settings,
  };
}
