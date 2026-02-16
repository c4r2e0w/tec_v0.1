-- Read policies for frontend visibility of equipment dictionaries
-- Run in Supabase SQL Editor

alter table public.equipment_subsystems enable row level security;
alter table public.workplace enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='equipment_subsystems'
      and policyname='equipment_subsystems_select_all'
  ) then
    create policy equipment_subsystems_select_all
      on public.equipment_subsystems
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='workplace'
      and policyname='workplace_select_all'
  ) then
    create policy workplace_select_all
      on public.workplace
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

