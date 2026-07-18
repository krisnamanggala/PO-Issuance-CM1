-- Extend retained PO revisions with the PRO purchasing group and contractual services.

alter table public.po_revisions
  drop constraint if exists po_revisions_purchasing_group_check;

alter table public.po_revisions
  add constraint po_revisions_purchasing_group_check
  check (purchasing_group in ('ELE', 'INS', 'ROT', 'PRO'));

alter table public.po_revisions
  add column if not exists supervision_installation_assist_included boolean not null default false,
  add column if not exists supervision_installation_assist_mandays numeric(12, 2),
  add column if not exists supervision_installation_assist_cost numeric(18, 2),
  add column if not exists precomm_commissioning_assist_included boolean not null default false,
  add column if not exists precomm_commissioning_assist_mandays numeric(12, 2),
  add column if not exists precomm_commissioning_assist_cost numeric(18, 2),
  add column if not exists training_included boolean not null default false,
  add column if not exists training_mandays numeric(12, 2),
  add column if not exists training_cost numeric(18, 2);

alter table public.po_revisions
  drop constraint if exists po_revisions_supervision_installation_assist_consistency,
  drop constraint if exists po_revisions_precomm_commissioning_assist_consistency,
  drop constraint if exists po_revisions_training_consistency;

alter table public.po_revisions
  add constraint po_revisions_supervision_installation_assist_consistency check (
    (supervision_installation_assist_included and supervision_installation_assist_mandays is not null and supervision_installation_assist_mandays >= 0 and supervision_installation_assist_cost is not null and supervision_installation_assist_cost >= 0)
    or (not supervision_installation_assist_included and supervision_installation_assist_mandays is null and supervision_installation_assist_cost is null)
  ),
  add constraint po_revisions_precomm_commissioning_assist_consistency check (
    (precomm_commissioning_assist_included and precomm_commissioning_assist_mandays is not null and precomm_commissioning_assist_mandays >= 0 and precomm_commissioning_assist_cost is not null and precomm_commissioning_assist_cost >= 0)
    or (not precomm_commissioning_assist_included and precomm_commissioning_assist_mandays is null and precomm_commissioning_assist_cost is null)
  ),
  add constraint po_revisions_training_consistency check (
    (training_included and training_mandays is not null and training_mandays >= 0 and training_cost is not null and training_cost >= 0)
    or (not training_included and training_mandays is null and training_cost is null)
  );
