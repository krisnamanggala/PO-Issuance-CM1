-- Vendor codes remain mandatory but are business identifiers, not quantities.
-- Existing integer codes are preserved by converting them to their text form.

alter table public.vendors
  drop constraint if exists vendors_vendor_code_non_negative,
  drop constraint if exists vendors_vendor_code_required;

alter table public.vendors
  alter column vendor_code type text using vendor_code::text,
  alter column vendor_code set not null;

alter table public.vendors
  add constraint vendors_vendor_code_required
  check (btrim(vendor_code) <> '' and length(vendor_code) <= 100);
