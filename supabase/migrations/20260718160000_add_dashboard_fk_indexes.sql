-- Cover dashboard and audit foreign keys identified by the Postgres advisor.
-- This migration is additive and safe to apply after the dashboard schema migration.

create index if not exists bonds_supersedes_bond_idx on public.bonds (supersedes_bond_id);
create index if not exists alerts_po_revision_idx on public.alerts (po_revision_id);
create index if not exists alerts_bond_idx on public.alerts (bond_id);
create index if not exists bond_history_bond_idx on public.bond_history (bond_id);
