-- Apply with the application release that no longer reads or writes progress_percent.
alter table public.delivery_updates
  drop column if exists progress_percent;
