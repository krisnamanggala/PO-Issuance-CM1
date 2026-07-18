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
});

test("ships the PO issuance monitoring surface without the starter skeleton", async () => {
  const [page, monitor, api, access, signIn] = await Promise.all([
    source("app/page.tsx"),
    source("app/po-monitor.tsx"),
    source("app/api/pos/import/route.ts"),
    source("app/lib/access.ts"),
    source("app/sign-in/sign-in-form.tsx"),
  ]);

  assert.match(page, /requireWorkspace/);
  assert.match(monitor, /TPEC CM1 PO Monitoring/);
  assert.match(monitor, /Payment-term milestones/);
  assert.match(monitor, /Supervision & installation assist/);
  assert.match(monitor, /Precomm\/commissioning assist/);
  assert.match(monitor, /Cost \(IDR\)/);
  assert.match(monitor, /Incoterm location/);
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

test("adds calculated procurement dashboard, bond history, and protected master data", async () => {
  const [dashboard, status, migration, masterApi, alertsApi] = await Promise.all([
    source("app/dashboard-overview.tsx"),
    source("app/lib/status.ts"),
    source("supabase/migrations/20260718154000_add_procurement_dashboard_data.sql"),
    source("app/api/master-data/route.ts"),
    source("app/api/alerts/route.ts"),
  ]);

  assert.match(dashboard, /Critical Actions/);
  assert.match(dashboard, /Active POs/);
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
