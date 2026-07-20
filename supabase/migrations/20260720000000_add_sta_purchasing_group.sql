-- Allow the STA purchasing group on retained PO revisions.

alter table public.po_revisions
  drop constraint if exists po_revisions_purchasing_group_check;

alter table public.po_revisions
  add constraint po_revisions_purchasing_group_check
  check (purchasing_group in ('ELE', 'INS', 'ROT', 'PRO', 'STA'));
