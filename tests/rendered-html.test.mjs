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
  assert.match(schema, /pb_validity date/);
  assert.match(schema, /wb_validity date/);
  assert.match(schema, /workspace_members/);
  assert.match(schema, /enable row level security/);
  assert.match(validation, /Missing required columns/);
  assert.match(validation, /must be Yes or No/);
  assert.match(validation, /Performance Bond validity is required/);
  assert.match(validation, /Warranty Bond validity is required/);
  assert.match(validation, /DD\/MM\/YYYY/);
  assert.match(validation, /incoterms/);
});

test("ships the PO issuance monitoring surface without the starter skeleton", async () => {
  const [page, monitor, api, access] = await Promise.all([
    source("app/page.tsx"),
    source("app/po-monitor.tsx"),
    source("app/api/pos/import/route.ts"),
    source("app/lib/access.ts"),
  ]);

  assert.match(page, /getWorkspaceActor/);
  assert.match(monitor, /TPEC CM1 PO Monitoring/);
  assert.match(monitor, /Payment-term milestones/);
  assert.match(monitor, /Incoterm location/);
  assert.match(monitor, /Current revisions/);
  assert.match(monitor, /Import CSV/);
  assert.match(monitor, /New revision/);
  assert.match(api, /No records were imported/);
  assert.match(access, /workspace_members/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
