-- Deduplicate equipment_subsystems by name
-- and move system-specific links into equipment_system_subsystems.
--
-- Run in Supabase SQL Editor.

create table if not exists public.equipment_system_subsystems (
  id bigserial primary key,
  system_id bigint not null references public.equipment_systems(id) on delete cascade,
  subsystem_id bigint not null references public.equipment_subsystems(id) on delete cascade,
  display_order integer not null default 0
);

create unique index if not exists equipment_system_subsystems_system_subsystem_uidx
  on public.equipment_system_subsystems (system_id, subsystem_id);

-- Ensure station_number exists for new architecture.
alter table public.equipment
  add column if not exists station_number text;

update public.equipment
set station_number = nullif(trim(name), '')
where station_number is null;

-- Build canonical IDs by subsystem name.
with canonical as (
  select
    upper(trim(name)) as name_key,
    min(id) as canonical_id
  from public.equipment_subsystems
  where nullif(trim(name), '') is not null
  group by upper(trim(name))
),
links as (
  select distinct
    sys.id as system_id,
    c.canonical_id as subsystem_id
  from public.equipment_subsystems es
  join canonical c
    on c.name_key = upper(trim(es.name))
  join public.equipment_systems sys
    on upper(trim(sys.name)) = upper(trim(es.system))
)
insert into public.equipment_system_subsystems (system_id, subsystem_id)
select system_id, subsystem_id
from links
on conflict (system_id, subsystem_id) do nothing;

-- Re-point equipment.subsystem_id to canonical ids.
with canonical as (
  select
    upper(trim(name)) as name_key,
    min(id) as canonical_id
  from public.equipment_subsystems
  where nullif(trim(name), '') is not null
  group by upper(trim(name))
),
remap as (
  select
    es.id as old_id,
    c.canonical_id as new_id
  from public.equipment_subsystems es
  join canonical c
    on c.name_key = upper(trim(es.name))
)
update public.equipment e
set subsystem_id = r.new_id
from remap r
where e.subsystem_id = r.old_id
  and e.subsystem_id is distinct from r.new_id;

-- Delete duplicate subsystem rows, keep min(id) per name.
with canonical as (
  select
    upper(trim(name)) as name_key,
    min(id) as canonical_id
  from public.equipment_subsystems
  where nullif(trim(name), '') is not null
  group by upper(trim(name))
)
delete from public.equipment_subsystems es
using canonical c
where upper(trim(es.name)) = c.name_key
  and es.id <> c.canonical_id;

-- Optional: clean inconsistent system text on catalog rows after dedup.
update public.equipment_subsystems
set system = null
where system is not null;

create index if not exists equipment_station_number_idx
  on public.equipment (station_number);

