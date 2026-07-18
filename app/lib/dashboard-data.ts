import { fromDatabaseBond } from "./bonds";
import { fromDatabase } from "./po-db";
import { defaultDashboardSettings, type DashboardSettings } from "./status";
import { createClient } from "./supabase/server";

export async function loadDashboardData() {
  const supabase = await createClient();
  const [posResult, bondsResult, settingsResult] = await Promise.all([
    supabase.from("po_revisions").select("*, projects(project_code, project_name)").order("released_date", { ascending: false }).order("revision_number", { ascending: false }),
    supabase.from("bonds").select("*, po_revisions(po_number, revision_number, vendor_name, projects(project_code))").order("updated_at", { ascending: false }),
    supabase.from("workspace_settings").select("delivery_warning_days, bond_critical_days, bond_warning_days").eq("id", 1).maybeSingle(),
  ]);
  if (posResult.error) throw posResult.error;
  if (bondsResult.error) throw bondsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  const settings: DashboardSettings = settingsResult.data ? {
    deliveryWarningDays: settingsResult.data.delivery_warning_days,
    bondCriticalDays: settingsResult.data.bond_critical_days,
    bondWarningDays: settingsResult.data.bond_warning_days,
  } : defaultDashboardSettings;
  return {
    records: (posResult.data ?? []).map((record) => fromDatabase(record as never)),
    bonds: (bondsResult.data ?? []).map((record) => fromDatabaseBond(record as never)),
    settings,
  };
}

