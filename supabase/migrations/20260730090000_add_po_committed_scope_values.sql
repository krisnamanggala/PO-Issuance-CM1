-- Separate the client-funded provisional commitment from the project base scope.
-- Existing releases pre-date this distinction, so they remain fully allocated to base scope.

alter table public.po_revisions
  add column if not exists scope_type text,
  add column if not exists base_scope_committed_value numeric(18, 2),
  add column if not exists provisional_scope_committed_value numeric(18, 2);

update public.po_revisions
set
  scope_type = coalesce(scope_type, 'Base scope'),
  base_scope_committed_value = coalesce(base_scope_committed_value, contract_value),
  provisional_scope_committed_value = coalesce(provisional_scope_committed_value, 0);

alter table public.po_revisions
  alter column scope_type set default 'Base scope',
  alter column scope_type set not null,
  alter column base_scope_committed_value set default 0,
  alter column base_scope_committed_value set not null,
  alter column provisional_scope_committed_value set default 0,
  alter column provisional_scope_committed_value set not null;

alter table public.po_revisions
  drop constraint if exists po_revisions_scope_type_allowed,
  drop constraint if exists po_revisions_committed_scope_values_consistency;

alter table public.po_revisions
  add constraint po_revisions_scope_type_allowed
    check (scope_type in ('Base scope', 'Provisional scope', 'Combination')),
  add constraint po_revisions_committed_scope_values_consistency
    check (
      base_scope_committed_value >= 0
      and provisional_scope_committed_value >= 0
      and contract_value = base_scope_committed_value + provisional_scope_committed_value
      and (
        (scope_type = 'Base scope' and provisional_scope_committed_value = 0)
        or (scope_type = 'Provisional scope' and base_scope_committed_value = 0)
        or (scope_type = 'Combination' and base_scope_committed_value > 0 and provisional_scope_committed_value > 0)
      )
    );
