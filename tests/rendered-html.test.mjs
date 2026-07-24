import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("defines the durable PO revision contract and CSV safeguards", async () => {
  const [schema, validation] = await Promise.all([
    source("supabase/migrations/20260718000000_create_po_monitoring.sql"),
    source("app/lib/po.ts"),
  ]);

  assert.match(schema, /po_revisions_po_revision_unique/);
  assert.match(schema, /delivery_lead_time_weeks/);
  assert.match(schema, /'ELE', 'INS', 'ROT', 'PRO'/);
  assert.match(schema, /pb_validity date/);
  assert.match(schema, /wb_validity date/);
  assert.match(schema, /supervision_installation_assist_included/);
  assert.match(schema, /precomm_commissioning_assist_included/);
  assert.match(schema, /training_included/);
  assert.match(schema, /workspace_members/);
  assert.match(schema, /@tripatra/);
  assert.match(schema, /enroll_tripatra_workspace_member/);
  assert.match(schema, /enable row level security/);
  assert.match(validation, /Missing required columns/);
  assert.match(validation, /must be Yes or No/);
  assert.match(validation, /Performance Bond validity is required/);
  assert.match(validation, /Warranty Bond validity is required/);
  assert.match(validation, /DD\/MM\/YYYY/);
  assert.match(validation, /incoterms/);
  assert.match(validation, /serviceInclusionValues/);
  assert.match(validation, /Included or Not included/);
  assert.match(validation, /calculateEtaRosAtSite/);
  assert.match(validation, /"project_code", "budget_idr"/);
  assert.match(validation, /Jakarta: 2/);
  assert.match(validation, /Overseas: 3/);
  assert.match(validation, /Site: 0/);
});

test("ships the PO issuance monitoring surface without the starter skeleton", async () => {
  const [page, monitor, api, access, signIn, poDatabase] = await Promise.all([
    source("app/page.tsx"),
    source("app/po-monitor.tsx"),
    source("app/api/pos/import/route.ts"),
    source("app/lib/access.ts"),
    source("app/sign-in/sign-in-form.tsx"),
    source("app/lib/po-db.ts"),
  ]);

  assert.match(page, /requireWorkspace/);
  assert.match(monitor, /TPEC CM1 PO Monitoring/);
  assert.match(monitor, /Payment-term milestones/);
  assert.match(monitor, /Supervision & installation assist/);
  assert.match(monitor, /Precomm\/commissioning assist/);
  assert.match(monitor, /Cost \(IDR, optional\)/);
  assert.match(monitor, /Location as per Incoterm/);
  assert.match(monitor, /incotermLocations\.map/);
  assert.match(monitor, /ETA to Site \(calculated\)/);
  assert.match(monitor, /formatEtaToSite/);
  assert.match(monitor, /PO issued date/);
  assert.match(poDatabase, /calculateEtaRosAtSite/);
  assert.match(monitor, /Current revisions/);
  assert.match(monitor, /Import CSV/);
  assert.match(monitor, /New revision/);
  assert.match(api, /No records were imported/);
  assert.match(access, /workspace_members/);
  assert.match(signIn, /signInWithPassword/);
  assert.match(signIn, /signUp/);
  assert.match(signIn, /tripatra\.com/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("restricts Incoterm locations while retaining historical PO rows", async () => {
  const [validation, migration] = await Promise.all([
    source("app/lib/po.ts"),
    source("supabase/migrations/20260722090000_restrict_incoterm_locations.sql"),
  ]);

  assert.match(validation, /incotermLocations = \["Jakarta", "Overseas", "Site"\]/);
  assert.match(validation, /Location as per Incoterm must be Jakarta, Overseas, or Site/);
  assert.match(migration, /po_revisions_location_allowed/);
  assert.match(migration, /location in \('Jakarta', 'Overseas', 'Site'\)/);
  assert.match(migration, /not valid/);
});

test("adds calculated procurement dashboard, bond history, and protected master data", async () => {
  const [dashboard, status, migration, masterApi, alertsApi] = await Promise.all([
    source("app/dashboard-overview.tsx"),
    source("app/lib/status.ts"),
    source("supabase/migrations/20260718154000_add_procurement_dashboard_data.sql"),
    source("app/api/master-data/route.ts"),
    source("app/api/alerts/route.ts"),
  ]);

  assert.match(dashboard, /Critical Actions/);
  assert.match(dashboard, /Committed PO value/);
  assert.match(dashboard, /currency/);
  assert.match(status, /deliveryStatus/);
  assert.match(status, /bondStatus/);
  assert.match(migration, /create table if not exists public\.bonds/);
  assert.match(migration, /create table if not exists public\.bond_history/);
  assert.match(migration, /create table if not exists public\.alert_history/);
  assert.match(migration, /is_workspace_admin/);
  assert.match(masterApi, /Only workspace administrators/);
  assert.match(alertsApi, /alert_history/);
});

test("adds normalized execution, cash, service, revision, and management-action data", async () => {
  const [migration, execution, executionApi, executionLib, dashboard, dashboardApi, status, monitor, alerts, deliveryMigration] = await Promise.all([
    source("supabase/migrations/20260718190000_add_executive_monitoring_data.sql"),
    source("app/execution-board.tsx"),
    source("app/api/execution/route.ts"),
    source("app/lib/execution.ts"),
    source("app/dashboard-overview.tsx"),
    source("app/api/dashboard/route.ts"),
    source("app/lib/status.ts"),
    source("app/po-monitor.tsx"),
    source("app/alerts-board.tsx"),
    source("supabase/migrations/20260722113000_add_delivery_workflow_statuses.sql"),
  ]);

  assert.match(migration, /create table if not exists public\.delivery_updates/);
  assert.match(migration, /create table if not exists public\.payment_milestones/);
  assert.match(migration, /create table if not exists public\.po_services/);
  assert.match(migration, /previous_revision_id/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert on public\.delivery_updates to authenticated/);
  assert.match(migration, /delivery_updates_po_revision_idx/);
  assert.match(migration, /payment_milestones_po_revision_idx/);
  assert.match(execution, /Delivery & Cash/);
  assert.match(execution, /Add delivery update/);
  assert.match(execution, /Add payment milestone/);
  assert.match(execution, /Forecast ETA Site/);
  assert.doesNotMatch(execution, /Progress \(%\)/);
  assert.match(execution, /deliveryUpdateStatuses\.map/);
  assert.match(executionLib, /approval-drawing/);
  assert.match(executionLib, /at-vendor-workshop/);
  assert.match(deliveryMigration, /at-vendor-workshop/);
  assert.match(executionApi, /validateDeliveryUpdate/);
  assert.match(executionApi, /validatePaymentMilestone/);
  assert.match(dashboard, /Budget headroom/);
  assert.match(dashboard, /Budget not set/);
  assert.match(status, /budgetUnavailablePos/);
  assert.match(dashboard, /All projects/);
  assert.match(dashboard, /selectProject/);
  assert.match(dashboard, /Project Overview/);
  assert.match(dashboard, /projectOverview/);
  assert.match(dashboardApi, /searchParams\.get\("project"\)/);
  assert.match(dashboardApi, /scopedRecords/);
  assert.match(dashboard, /Unpaid cash milestones/);
  assert.match(dashboard, /Supplier Concentration/);
  assert.match(status, /revisionDeltaByCurrency/);
  assert.match(status, /projectOverview/);
  assert.match(status, /unpaidValueByCurrency/);
  assert.match(monitor, /Revision reason/);
  assert.match(alerts, /Action owner/);
  assert.match(alerts, /Management due date/);
});

test("allows optional service estimates when services are included", async () => {
  const [validation, monitor, migration] = await Promise.all([
    source("app/lib/po.ts"),
    source("app/po-monitor.tsx"),
    source("supabase/migrations/20260724090000_allow_optional_service_estimates.sql"),
  ]);

  assert.match(validation, /isNotApplicable\(mandaysRaw\) \? null/);
  assert.match(validation, /isNotApplicable\(costRaw\) \? null/);
  assert.match(monitor, /Man-days and IDR cost are optional/);
  assert.match(monitor, /Man-days \(optional\)/);
  assert.match(migration, /po_services_inclusion_values_check/);
  assert.match(migration, /mandays is null or mandays >= 0/);
});

test("enforces the revised vendor and currency contract without removing historical values", async () => {
  const [po, monitor, bonds, master, masterApi, migration, vendorMigration, vendorTextMigration, uppercaseMigration, styles] = await Promise.all([
    source("app/lib/po.ts"),
    source("app/po-monitor.tsx"),
    source("app/bond-register.tsx"),
    source("app/master-data-manager.tsx"),
    source("app/api/master-data/route.ts"),
    source("supabase/migrations/20260718170000_enforce_vendor_code_and_currency_options.sql"),
    source("supabase/migrations/20260718180000_make_vendor_code_integer.sql"),
    source("supabase/migrations/20260719100000_make_vendor_code_text.sql"),
    source("supabase/migrations/20260719110000_uppercase_master_data.sql"),
    source("app/globals.css"),
  ]);

  assert.match(po, /currencyCodes = \["IDR", "USD", "AUD", "JPY", "CNY", "GBP", "EUR"\]/);
  assert.match(po, /Currency must be IDR, USD, AUD, JPY, CNY, GBP, or EUR/);
  assert.match(monitor, /SearchableSelect label="Vendor"/);
  assert.match(monitor, /\$\{vendor\.vendor_name\} \(\$\{vendor\.vendor_code\}\)/);
  assert.doesNotMatch(monitor, /<fieldset><legend>Operational status<\/legend>/);
  assert.doesNotMatch(bonds, /Input label="Expected bond value"/);
  assert.doesNotMatch(bonds, /Input label="Received date"/);
  assert.doesNotMatch(bonds, /Input label="Issue date"/);
  assert.doesNotMatch(bonds, /Input label="Released date"/);
  assert.match(bonds, /Input label="Effective date" type="date"/);
  assert.match(bonds, /Input label="Expiry date" type="date"/);
  assert.match(bonds, /<span>PO No\.<\/span>/);
  assert.match(masterApi, /Vendor code is required\./);
  assert.match(masterApi, /Vendor code must be 100 characters or fewer\./);
  assert.match(master, /type="text" maxLength=\{100\}/);
  assert.match(master, /mandatory text and may contain letters, numbers, or leading zeroes/);
  assert.match(master, /setCode\(event\.target\.value\.toUpperCase\(\)\)/);
  assert.match(master, /setName\(event\.target\.value\.toUpperCase\(\)\)/);
  assert.match(masterApi, /projectName.*trim\(\)\.toUpperCase\(\)/);
  assert.match(masterApi, /vendorName.*trim\(\)\.toUpperCase\(\)/);
  assert.match(masterApi, /vendorCodeRaw.*trim\(\)\.toUpperCase\(\)/);
  assert.match(migration, /vendors_vendor_code_required/);
  assert.match(migration, /po_revisions_currency_code_allowed/);
  assert.match(migration, /bonds_currency_code_allowed/);
  assert.match(vendorMigration, /alter column vendor_code type integer/);
  assert.match(vendorMigration, /alter column vendor_code set not null/);
  assert.match(vendorTextMigration, /alter column vendor_code type text using vendor_code::text/);
  assert.match(vendorTextMigration, /btrim\(vendor_code\) <> ''/);
  assert.match(uppercaseMigration, /alter column project_code type text/);
  assert.match(uppercaseMigration, /projects_project_code_uppercase/);
  assert.match(uppercaseMigration, /vendors_vendor_name_uppercase/);
  assert.match(uppercaseMigration, /po_revisions_vendor_name_uppercase/);
  assert.match(styles, /\.master-panel \.panel-heading \{ border-bottom: 0; \}/);
});
