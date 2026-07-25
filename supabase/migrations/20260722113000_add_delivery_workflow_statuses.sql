alter table public.delivery_updates
  drop constraint if exists delivery_updates_delivery_status_check;

alter table public.delivery_updates
  add constraint delivery_updates_delivery_status_check check (delivery_status in (
    'not-started', 'approval-drawing', 'manufacturing', 'ready-to-ship', 'in-transit',
    'at-vendor-workshop', 'arrived-at-site', 'completed', 'cancelled'
  ));
