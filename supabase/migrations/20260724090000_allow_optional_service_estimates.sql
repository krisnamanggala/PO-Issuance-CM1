alter table public.po_revisions
  drop constraint if exists po_revisions_supervision_installation_assist_consistency,
  drop constraint if exists po_revisions_precomm_commissioning_assist_consistency,
  drop constraint if exists po_revisions_training_consistency;

alter table public.po_revisions
  add constraint po_revisions_supervision_installation_assist_consistency check (
    (supervision_installation_assist_included
      and (supervision_installation_assist_mandays is null or supervision_installation_assist_mandays >= 0)
      and (supervision_installation_assist_cost is null or supervision_installation_assist_cost >= 0))
    or (not supervision_installation_assist_included
      and supervision_installation_assist_mandays is null
      and supervision_installation_assist_cost is null)
  ),
  add constraint po_revisions_precomm_commissioning_assist_consistency check (
    (precomm_commissioning_assist_included
      and (precomm_commissioning_assist_mandays is null or precomm_commissioning_assist_mandays >= 0)
      and (precomm_commissioning_assist_cost is null or precomm_commissioning_assist_cost >= 0))
    or (not precomm_commissioning_assist_included
      and precomm_commissioning_assist_mandays is null
      and precomm_commissioning_assist_cost is null)
  ),
  add constraint po_revisions_training_consistency check (
    (training_included
      and (training_mandays is null or training_mandays >= 0)
      and (training_cost is null or training_cost >= 0))
    or (not training_included
      and training_mandays is null
      and training_cost is null)
  );

alter table public.po_services
  drop constraint if exists po_services_inclusion_values_check,
  add constraint po_services_inclusion_values_check check (
    (included and (mandays is null or mandays >= 0) and (cost_idr is null or cost_idr >= 0))
    or (not included and mandays is null and cost_idr is null)
  );
