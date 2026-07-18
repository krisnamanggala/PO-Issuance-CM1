# TPEC CM1 PO Monitoring

TPEC CM1 PO Monitoring is a workspace-restricted procurement operations application for SCM Category Management 1. It monitors current PO revisions, delivery schedules, Performance Bonds (PB), Warranty Bonds (WB), services, and the exception actions that require follow-up.

## Workspace structure

- **Overview** — eight live risk indicators, a combined Critical Actions queue, currency-separated values, delivery/bond status distribution, vendor delay and project-risk summaries.
- **PO Register** — current or all revisions, search and register filters, details, edits, new revisions, CSV intake, payment milestones, services, and delivery schedules.
- **Bond Register** — PB/WB records, expiry status, bond CSV intake, and retained create/edit/release/extension history.
- **Alerts** — derived exceptions with Open, Acknowledged and Resolved workflow records.
- **Master Data** — projects, vendors, static category values, and master-data activation controls.
- **Settings** — delivery and bond-warning thresholds.

The current application uses one protected CM1 workspace. Existing `workspace_members` records retain access; the earliest existing member is assigned the `admin` role when the dashboard migration runs. Other members are `editor`s.

## Status definitions

PO delivery status is calculated from the latest revision only:

- **Completed** — `delivery_completed_at` is set.
- **Cancelled** — `cancelled_at` is set.
- **Missing ETA** — active PO without an ETA.
- **Delayed** — active PO with ETA before today.
- **Due soon** — active PO with ETA from today through the delivery threshold (30 days by default).
- **On track** — active PO with ETA after that threshold.

PB and WB are contractual details, not delivery signals. A bond is **N/A** when the related PO does not require it; otherwise the precedence is Released, Replaced, Missing, Expired, Critical (0–30 days by default), Expiring soon (31–60), and Valid. Thresholds can be changed by an administrator in Settings.

## Database migrations

Apply the SQL migrations in chronological order. For an already-running workspace that has the original PO tables and services migration, apply:

```text
supabase/migrations/20260718154000_add_procurement_dashboard_data.sql
supabase/migrations/20260718170000_enforce_vendor_code_and_currency_options.sql
```

This is an additive migration: it does not delete PO data or rename existing fields. It adds:

- `role` on `workspace_members`
- `projects`, `vendors`, and `workspace_settings`
- optional PO project/vendor/currency/operational columns
- `bonds`, `bond_history`, `alerts`, and `alert_history`
- indexes and RLS policies for new tables
- admin-only policies for master data and settings

Run it from Supabase SQL Editor, the Supabase CLI, or the connected Supabase migration tool. Do not use the service-role key in browser code. The migration contains no `DROP TABLE` or data-deleting operation; rollback should be planned as a forward migration if it is ever needed.

## CSV templates and validation

PO and bond templates are separate downloads in their registers.

- PO import requires the existing PO contract, including ISO release/ETA dates, allowed groups (`ELE`, `INS`, `ROT`, `PRO`), payment terms, Incoterms, services, valid PB/WB values, and a currency of `IDR`, `USD`, `AUD`, `JPY`, `CNY`, `GBP`, or `EUR`. PB/WB validity remains `DD/MM/YYYY` in the PO form and is normalized for storage.
- A supplied PO project code must already be in Project master data. Every supplied vendor must match an active Vendor master record, whose vendor code is required. Imports reject duplicate PO/revision keys and do not insert a batch with validation errors.
- Bond import requires a PO/revision match, an active unique bond identity, ISO dates, one of the allowed currencies above, and a bond number for safe CSV duplicate protection.

The PO operational-status and expected-bond-value controls are no longer entry fields. Their historic database columns are intentionally retained so existing historical records remain readable; new register records use the revised form contract.

The intake dialogs show the selected row count before confirmation and display field-level errors when a file is rejected.

## Roles and security

- Every user must authenticate with a `@tripatra.com` email/password account.
- Supabase Auth session persistence is configured in Supabase; set its time-boxed session duration to 90 days for the requested three-month sign-in experience.
- RLS restricts PO, bond, alert, project, vendor and settings reads to authenticated workspace members.
- Editors can create and update PO/bond/alert records. Only administrators can create or activate/deactivate master data and change risk settings. Roles are read from `workspace_members` on the server and enforced again by RLS.

## Environment variables

Set these in `.env.local` for development and in all Vercel environments:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

No additional environment variables are needed. Configure a production SMTP provider in Supabase Auth before go-live.

## Local development

```bash
cp .env.example .env.local
pnpm dev
pnpm lint
pnpm test
```

The app is a Next.js App Router project and requires Node.js 22.13 or later.

## Vercel deployment

1. Import the repository into Vercel and use the repository root as the project root.
2. Add the two Supabase environment variables to Development, Preview, and Production.
3. In Supabase Auth, add the Vercel production URL plus preview URLs as redirect URLs and keep email confirmation enabled.
4. Apply the database migration before deploying the UI that uses the new tables.
5. Deploy the `main` branch for production; use other branches for Vercel preview deployments.

Before production, run linting, TypeScript checks, the test suite, and a production build.
