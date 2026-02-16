-- Final cleanup: remove legacy equipment subsystem structures.
-- Assumes app uses only:
--   equipment.system_id
--   equipment.subsystem_type_id
--   equipment_systems
--   subsystem_types
--
-- Run in Supabase SQL Editor after verifying data.

begin;

-- 1) Ensure subsystem_types contains all names that might still exist in legacy table.
insert into public.subsystem_types (code, full_name)
select
  upper(trim(es.name)) as code,
  max(nullif(trim(es.description), '')) as full_name
from public.equipment_subsystems es
where nullif(trim(es.name), '') is not null
group by upper(trim(es.name))
on conflict (code) do update
set full_name = coalesce(public.subsystem_types.full_name, excluded.full_name);

-- 2) Backfill equipment.subsystem_type_id from legacy references if still null.
update public.equipment e
set subsystem_type_id = st.id
from public.equipment_subsystems es
join public.subsystem_types st on st.code = upper(trim(es.name))
where e.subsystem_type_id is null
  and e.subsystem_id = es.id;

-- 3) Ensure required columns are present and indexed.
alter table public.equipment
  add column if not exists subsystem_type_id bigint,
  add column if not exists system_id bigint;

create index if not exists equipment_subsystem_type_id_idx
  on public.equipment(subsystem_type_id);

create index if not exists equipment_system_id_idx
  on public.equipment(system_id);

-- 4) Drop legacy FK first if present.
alter table public.equipment
  drop constraint if exists equipment_subsystem_id_fk;

alter table public.equipment
  drop constraint if exists equipment_subsystem_catalog_id_fk;

-- 5) Drop legacy columns.
alter table public.equipment
  drop column if exists subsystem_id,
  drop column if exists subsystem_catalog_id;

-- 6) Drop legacy tables.
drop table if exists public.equipment_subsystems cascade;
drop table if exists public.equipment_subsystem_catalog cascade;
drop table if exists public.equipment_system_subsystems cascade;

commit;
