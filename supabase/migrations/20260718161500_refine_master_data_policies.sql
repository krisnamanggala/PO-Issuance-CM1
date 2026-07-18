-- Keep the member SELECT policies single-purpose while retaining admin-only writes.
-- Policy changes do not remove any records or relax access controls.

drop policy if exists "Workspace admins can manage projects" on public.projects;
create policy "Workspace admins can create projects"
on public.projects for insert to authenticated
with check ((select private.is_workspace_admin()));
create policy "Workspace admins can update projects"
on public.projects for update to authenticated
using ((select private.is_workspace_admin()))
with check ((select private.is_workspace_admin()));

drop policy if exists "Workspace admins can manage vendors" on public.vendors;
create policy "Workspace admins can create vendors"
on public.vendors for insert to authenticated
with check ((select private.is_workspace_admin()));
create policy "Workspace admins can update vendors"
on public.vendors for update to authenticated
using ((select private.is_workspace_admin()))
with check ((select private.is_workspace_admin()));
