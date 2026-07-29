-- Add a read-only viewer role and let administrators manage workspace roles safely.

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  add constraint workspace_members_role_check check (role in ('admin', 'editor', 'viewer'));

create or replace function private.is_workspace_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where user_id = (select auth.uid())
      and role in ('admin', 'editor')
  );
$$;

revoke all on function private.is_workspace_editor() from public, anon;
grant execute on function private.is_workspace_editor() to authenticated;

create or replace function private.prevent_last_workspace_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
    and new.role <> 'admin'
    and not exists (
      select 1
      from public.workspace_members
      where user_id <> old.user_id
        and role = 'admin'
    ) then
    raise exception 'At least one workspace administrator is required.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_last_workspace_admin() from public, anon, authenticated;

drop trigger if exists prevent_last_workspace_admin on public.workspace_members;
create trigger prevent_last_workspace_admin
before update of role on public.workspace_members
for each row execute function private.prevent_last_workspace_admin();

grant select on public.workspace_members to authenticated;
grant update (role) on public.workspace_members to authenticated;

drop policy if exists "Members can read their own workspace membership" on public.workspace_members;
create policy "Workspace members can read their own membership"
on public.workspace_members for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Workspace admins can read all memberships"
on public.workspace_members for select to authenticated
using ((select private.is_workspace_admin()));
create policy "Workspace admins can update membership roles"
on public.workspace_members for update to authenticated
using ((select private.is_workspace_admin()))
with check (true);

drop policy if exists "Workspace members can create PO revisions" on public.po_revisions;
drop policy if exists "Workspace members can update PO revisions" on public.po_revisions;
create policy "Workspace editors can create PO revisions"
on public.po_revisions for insert to authenticated
with check ((select private.is_workspace_editor()));
create policy "Workspace editors can update PO revisions"
on public.po_revisions for update to authenticated
using ((select private.is_workspace_editor()))
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can add delivery updates" on public.delivery_updates;
create policy "Workspace editors can add delivery updates"
on public.delivery_updates for insert to authenticated
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can add payment milestones" on public.payment_milestones;
drop policy if exists "Workspace members can update payment milestones" on public.payment_milestones;
create policy "Workspace editors can add payment milestones"
on public.payment_milestones for insert to authenticated
with check ((select private.is_workspace_editor()));
create policy "Workspace editors can update payment milestones"
on public.payment_milestones for update to authenticated
using ((select private.is_workspace_editor()))
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can add PO services" on public.po_services;
drop policy if exists "Workspace members can update PO services" on public.po_services;
create policy "Workspace editors can add PO services"
on public.po_services for insert to authenticated
with check ((select private.is_workspace_editor()));
create policy "Workspace editors can update PO services"
on public.po_services for update to authenticated
using ((select private.is_workspace_editor()))
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can create bonds" on public.bonds;
drop policy if exists "Workspace members can update bonds" on public.bonds;
create policy "Workspace editors can create bonds"
on public.bonds for insert to authenticated
with check ((select private.is_workspace_editor()));
create policy "Workspace editors can update bonds"
on public.bonds for update to authenticated
using ((select private.is_workspace_editor()))
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can add bond history" on public.bond_history;
create policy "Workspace editors can add bond history"
on public.bond_history for insert to authenticated
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can create alerts" on public.alerts;
drop policy if exists "Workspace members can update alerts" on public.alerts;
create policy "Workspace editors can create alerts"
on public.alerts for insert to authenticated
with check ((select private.is_workspace_editor()));
create policy "Workspace editors can update alerts"
on public.alerts for update to authenticated
using ((select private.is_workspace_editor()))
with check ((select private.is_workspace_editor()));

drop policy if exists "Workspace members can add alert history" on public.alert_history;
create policy "Workspace editors can add alert history"
on public.alert_history for insert to authenticated
with check ((select private.is_workspace_editor()));
