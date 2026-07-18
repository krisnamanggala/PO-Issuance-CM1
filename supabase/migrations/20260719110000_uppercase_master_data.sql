-- Project and vendor identifiers/names are stored as uppercase text.
-- Refuse normalization if two existing codes would collide after casing.

do $$
begin
  if exists (
    select upper(btrim(project_code::text))
    from public.projects
    group by upper(btrim(project_code::text))
    having count(*) > 1
  ) then
    raise exception 'Project codes must be made unique before uppercase normalization.';
  end if;

  if exists (
    select upper(btrim(vendor_code))
    from public.vendors
    group by upper(btrim(vendor_code))
    having count(*) > 1
  ) then
    raise exception 'Vendor codes must be made unique before uppercase normalization.';
  end if;
end
$$;

alter table public.projects
  alter column project_code type text using upper(btrim(project_code::text));

update public.projects
set project_name = upper(btrim(project_name));

update public.vendors
set vendor_code = upper(btrim(vendor_code)),
    vendor_name = upper(btrim(vendor_name));

update public.po_revisions
set vendor_name = upper(btrim(vendor_name));

alter table public.projects
  drop constraint if exists projects_project_code_uppercase,
  drop constraint if exists projects_project_name_uppercase;

alter table public.projects
  add constraint projects_project_code_uppercase
    check (project_code <> '' and project_code = btrim(project_code) and project_code = upper(project_code)),
  add constraint projects_project_name_uppercase
    check (project_name = btrim(project_name) and project_name = upper(project_name));

alter table public.vendors
  drop constraint if exists vendors_vendor_code_required,
  drop constraint if exists vendors_vendor_name_uppercase;

alter table public.vendors
  add constraint vendors_vendor_code_required
    check (vendor_code <> '' and length(vendor_code) <= 100 and vendor_code = btrim(vendor_code) and vendor_code = upper(vendor_code)),
  add constraint vendors_vendor_name_uppercase
    check (vendor_name <> '' and vendor_name = btrim(vendor_name) and vendor_name = upper(vendor_name));

alter table public.po_revisions
  drop constraint if exists po_revisions_vendor_name_uppercase;

alter table public.po_revisions
  add constraint po_revisions_vendor_name_uppercase
    check (vendor_name = btrim(vendor_name) and vendor_name = upper(vendor_name));
