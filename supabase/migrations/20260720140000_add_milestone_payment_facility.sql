-- Payment milestones: record the payment facility (T/T, SKBDN, LC, or Swift).
alter table public.payment_milestones
  add column if not exists payment_facility text
  check (payment_facility is null or payment_facility in ('T/T', 'SKBDN', 'LC', 'Swift'));
