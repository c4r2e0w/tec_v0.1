-- Equipment structure cleanup:
-- - add station_number (unit number/designation)
-- - keep name as legacy field for compatibility
-- - ensure subsystem relation and readable access for UI

alter table public.equipment
  add column if not exists station_number text;

update public.equipment
set station_number = nullif(trim(name), '')
where station_number is null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'equipment'
      and constraint_name = 'equipment_subsystem_id_fk'
  ) then
    alter table public.equipment
      add constraint equipment_subsystem_id_fk
      foreign key (subsystem_id)
      references public.equipment_subsystems(id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists equipment_subsystem_id_idx on public.equipment (subsystem_id);
create index if not exists equipment_system_idx on public.equipment (equipment_system);
create index if not exists equipment_station_number_idx on public.equipment (station_number);

-- Read access for subsystem dictionary in frontend.
alter table public.equipment_subsystems enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipment_subsystems'
      and policyname = 'equipment_subsystems_read_all'
  ) then
    create policy equipment_subsystems_read_all
      on public.equipment_subsystems
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

