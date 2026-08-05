# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

TPEC CM1 PO Monitoring — a Next.js 16 (App Router) + Supabase application for SCM Category Management 1. It tracks purchase-order revisions, delivery schedules, Performance/Warranty Bonds, payment milestones, services, and derived alerts for a single protected CM1 workspace.

See `README.md` for the functional spec (status definitions, CSV/Excel intake rules, deployment). This file covers what is not obvious from reading the code.

## Commands

```bash
pnpm install
pnpm dev      # next dev
pnpm build    # next build
pnpm lint     # eslint . (next core-web-vitals + typescript configs)
pnpm test     # runs `pnpm build` FIRST, then node --test tests/rendered-html.test.mjs
```

`pnpm test` includes a full production build, so it is slow. To iterate on assertions only:
`node --test tests/rendered-html.test.mjs`.

There is no `typecheck` script — `pnpm build` is the type gate. Requires Node >= 22.13 and pnpm 11.

## The test suite is a source-text contract, not behavioral tests

`tests/rendered-html.test.mjs` is the single test file, and it asserts with **regexes against raw file contents** — migrations, `app/lib/*.ts`, and `.tsx` components are read with `readFile` and matched against literal strings.

Consequences to internalize before editing anything:

- Renaming a UI label, changing copy, reordering an array literal, or reformatting a line can fail the suite even when behavior is unchanged. Example assertions: `/Cost \(IDR, optional\)/` in `po-monitor.tsx`, `/currencyCodes = \["IDR", "USD", "AUD", "JPY", "CNY", "GBP", "EUR"\]/` in `po.ts`, `/\.notice \+ \.master-grid \{ margin-top: 18px; \}/` in `globals.css`.
- Some assertions are negative (`assert.doesNotMatch`) — they exist to guarantee removed fields stay removed (e.g. the operational-status fieldset, the bond "Expected bond value"/"Received date" inputs).
- When you intentionally change a labelled field, an enum, or a migration name, **update the matching assertion in the same commit**. Do not delete an assertion to make a test pass; rewrite it to describe the new contract.
- New migrations that establish a rule generally get a matching assertion, following the existing per-feature `test(...)` block pattern.

## Architecture

```
proxy.ts                 # Next 16 middleware equivalent (NOT middleware.ts) — refreshes the Supabase session
app/lib/po.ts            # Domain enums, PORecord type, validatePOInput, formatPOReference, ETA calculation
app/lib/po-db.ts         # toInsertRecord / fromDatabase — camelCase <-> snake_case boundary
app/lib/status.ts        # Derived delivery + bond status, dashboard aggregates
app/lib/execution.ts     # Delivery updates, payment milestones, PO services
app/lib/access.ts        # getAuthenticatedUser, getWorkspaceActor, canEditWorkspace
app/lib/page-access.ts   # requireWorkspace(next) — redirects for server components
app/lib/supabase/        # server.ts (RSC/route handlers), client.ts (browser), proxy.ts, env.ts
app/api/**/route.ts      # Route handlers
app/*.tsx                # Top-level client boards (po-monitor, bond-register, dashboard-overview, ...)
supabase/migrations/     # The real schema
```

Import alias: `@/*` maps to the repo root, so imports read `@/app/lib/po`.

Domain enums and their derived types live in `app/lib/po.ts` as `as const` arrays. Add a value there, add the matching SQL check-constraint migration, and update the test assertion — all three, or the value is only half-supported.

## Auth and authorization — required in every route handler

Every API route repeats this shape. Follow it exactly; there is no shared wrapper.

```ts
const actor = await getWorkspaceActor();
if (!actor) return Response.json({ error: "Sign in is required." }, { status: 401 });
if (!canEditWorkspace(actor.role)) return Response.json({ error: "Viewer access is read-only." }, { status: 403 });
```

- Roles are `admin` | `editor` | `viewer`, read from `workspace_members`. Master data and settings are admin-only (`isAdmin` check inline in `app/api/master-data/route.ts`).
- Server components call `requireWorkspace(path)` instead, which redirects to `/sign-in` or `/unauthorized`.
- Application checks are defence in depth — RLS enforces the same rules in Postgres. Changing a permission means changing **both** the route handler and the RLS policy migration.

## Supabase conventions

- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used. **Never introduce the service-role key**, and never bypass RLS — the app is designed so that browser and server use the same publishable key.
- `app/lib/supabase/server.ts` swallows cookie-write failures because Server Components cannot set cookies; `proxy.ts` is what actually refreshes the session. Do not "fix" that empty catch.
- Access env only through `getSupabaseEnv()` / `hasSupabaseEnv()`, which throw a single actionable message when unset.

## Migrations

Files are `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, applied in filename order.

- **Additive and forward-only.** No `DROP TABLE`, no destructive rewrites, no editing an already-applied migration. A correction is a new migration (see the `vendor_code` integer → text pair).
- Columns that are no longer entry fields are deliberately retained so historical rows stay readable. Do not drop them for tidiness.
- New check constraints on existing tables are added `not valid` so legacy rows survive (see `20260722090000_restrict_incoterm_locations.sql`).
- Every new table needs `enable row level security`, explicit policies, `grant`s to `authenticated`, and FK indexes.

## Domain invariants

- **ETA to Site is calculated, never entered**: PO issued date + delivery lead time weeks + transit (`Jakarta` 2, `Overseas` 3, `Site` 0), via `calculateEtaRosAtSite`.
- **Dates**: `DD/MM/YYYY` in forms and display; ISO in the database. `app/lib/po.ts` owns the normalization.
- **Master data is uppercased** on write in `app/api/master-data/route.ts` and in the UI inputs, and constrained by the `*_uppercase` check constraints.
- **Committed values**: `contract_value = base_scope_committed_value + provisional_scope_committed_value`, enforced by constraint. `Combination` scope requires both.
- **Money is handled as strings** in `PORecord` (`budget`, `contractValue`, ...) to avoid float drift. Keep it that way.
- A PO revision is unique on (PO number, revision number); duplicate inserts surface as Postgres `23505` and are translated to user-facing copy in the route handler.
- Vendors must be active master-data records with a non-empty `vendor_code`; project codes must exist in Project master data.

## Style

- TypeScript `strict`, double quotes, 2-space indent, named exports, `type` over `interface`.
- Route handlers return `Response.json(...)`; errors are user-facing sentences ("Choose a vendor from master data."), never raw Postgres messages. Keep the internal detail out of the response body.
- Client boards are large single-file components — match the surrounding density rather than refactoring opportunistically, since the test suite pins their text.

## Repository cruft — ignore, do not build on

- `drizzle/` — SQLite/D1 migrations from an earlier prototype. Drizzle is **not** a dependency and nothing imports it. The live schema is `supabase/migrations/`.
- `examples/` and `examples/d1/` — contain only `.DS_Store`.
- `.DS_Store` files are committed throughout; leave them alone unless asked to clean up.

## Known drift

`README.md` lists purchasing groups as `ELE, INS, ROT, PRO`; the code and schema also allow `STA` (`20260720000000_add_sta_purchasing_group.sql`). Trust `app/lib/po.ts`.
