-- Payment milestones: add a relative "due date (in days)" term selected from a fixed list.
alter table public.payment_milestones
  add column if not exists due_date_days integer
  check (due_date_days is null or due_date_days > 0);

-- Bond register: the bond number is auto-generated from the PO No. and vendor code
-- and must be unique across the register (nulls remain allowed for legacy/migrated rows).
create unique index if not exists bonds_bond_number_unique_idx
  on public.bonds (bond_number)
  where bond_number is not null;
