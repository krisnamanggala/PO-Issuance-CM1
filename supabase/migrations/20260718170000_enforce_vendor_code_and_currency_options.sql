-- Enforce the revised entry contract without rewriting historical data.
-- NOT VALID constraints apply to new or updated rows while retaining legacy rows.

alter table public.vendors
  add constraint vendors_vendor_code_required
  check (vendor_code is not null and btrim(vendor_code) <> '') not valid;

alter table public.po_revisions
  add constraint po_revisions_currency_code_allowed
  check (currency_code in ('IDR', 'USD', 'AUD', 'JPY', 'CNY', 'GBP', 'EUR')) not valid;

alter table public.bonds
  add constraint bonds_currency_code_allowed
  check (currency_code in ('IDR', 'USD', 'AUD', 'JPY', 'CNY', 'GBP', 'EUR')) not valid;
