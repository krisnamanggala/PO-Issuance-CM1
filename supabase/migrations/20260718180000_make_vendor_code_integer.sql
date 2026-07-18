-- Vendor codes are mandatory non-negative integers.
-- Refuse to guess or rewrite any legacy code that is blank, non-numeric,
-- or outside the PostgreSQL integer range.

do $$
begin
  if exists (
    select 1
    from public.vendors
    where vendor_code is null
       or btrim(vendor_code) = ''
       or case
            when btrim(vendor_code) ~ '^[0-9]+$'
              then btrim(vendor_code)::numeric > 2147483647
            else true
          end
  ) then
    raise exception 'Every existing vendor must have a numeric code from 0 to 2147483647 before this migration can run.';
  end if;
end
$$;

alter table public.vendors
  drop constraint if exists vendors_vendor_code_required;

alter table public.vendors
  alter column vendor_code type integer using btrim(vendor_code)::integer,
  alter column vendor_code set not null;

alter table public.vendors
  add constraint vendors_vendor_code_non_negative
  check (vendor_code >= 0);
