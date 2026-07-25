-- Restrict new and updated PO records to the operational Incoterm locations.
-- NOT VALID preserves historical records that used free-text locations.

alter table public.po_revisions
  add constraint po_revisions_location_allowed
  check (location in ('Jakarta', 'Overseas', 'Site')) not valid;
