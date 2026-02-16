-- Final normalized architecture:
-- 1) system_types
-- 2) equipment_systems (concrete instances) -> system_type_id
-- 3) subsystem_types (unique subsystem dictionary)
-- 4) system_subsystems (many-to-many link)
-- 5) equipment -> references system_id + subsystem_type_id + station_number
--
-- Also removes temporary/experimental tables created earlier.

-- 1. System types
create table if not exists public.system_types (
  id bigserial primary key,
  name text not null unique
);

insert into public.system_types (name)
values
  ('Турбоагрегат'),
  ('Котлоагрегат'),
  ('Общестанционная система'),
  ('Теплосеть'),
  ('Техническая вода'),
  ('Собственные нужды')
on conflict (name) do nothing;

alter table public.equipment_systems
  add column if not exists system_type_id bigint;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema='public'
      and table_name='equipment_systems'
      and constraint_name='equipment_systems_system_type_id_fk'
  ) then
    alter table public.equipment_systems
      add constraint equipment_systems_system_type_id_fk
      foreign key (system_type_id)
      references public.system_types(id)
      on update cascade
      on delete set null;
  end if;
end $$;

with st as (
  select id, name from public.system_types
)
update public.equipment_systems es
set system_type_id = (
  case
    when es.name ~* '^ТА\\s*-?\\s*\\d+' then (select id from st where name='Турбоагрегат')
    when es.name ~* '^КА\\s*-?\\s*\\d+' then (select id from st where name='Котлоагрегат')
    when upper(trim(es.name)) = 'ТЕПЛОСЕТЬ' then (select id from st where name='Теплосеть')
    when upper(trim(es.name)) = 'ТЕХНИЧЕСКАЯ ВОДА' then (select id from st where name='Техническая вода')
    when upper(trim(es.name)) = 'СОБСТВЕННЫЕ НУЖДЫ' then (select id from st where name='Собственные нужды')
    else (select id from st where name='Общестанционная система')
  end
)
where es.system_type_id is null;

create index if not exists equipment_systems_system_type_id_idx
  on public.equipment_systems(system_type_id);

-- 2. Subsystem types (single dictionary without duplicates across systems)
create table if not exists public.subsystem_types (
  id bigserial primary key,
  code text not null unique,
  full_name text
);

insert into public.subsystem_types (code, full_name)
select
  upper(trim(es.name)) as code,
  max(nullif(trim(es.description), '')) as full_name
from public.equipment_subsystems es
where nullif(trim(es.name), '') is not null
group by upper(trim(es.name))
on conflict (code) do update
set full_name = coalesce(public.subsystem_types.full_name, excluded.full_name);

-- 3. System <-> subsystem link
create table if not exists public.system_subsystems (
  id bigserial primary key,
  system_id bigint not null references public.equipment_systems(id) on delete cascade,
  subsystem_type_id bigint not null references public.subsystem_types(id) on delete cascade
);

create unique index if not exists system_subsystems_system_subtype_uidx
  on public.system_subsystems(system_id, subsystem_type_id);

insert into public.system_subsystems (system_id, subsystem_type_id)
select distinct
  sys.id as system_id,
  st.id as subsystem_type_id
from public.equipment_subsystems es
join public.equipment_systems sys
  on upper(trim(sys.name)) = upper(trim(es.system))
join public.subsystem_types st
  on st.code = upper(trim(es.name))
on conflict (system_id, subsystem_type_id) do nothing;

-- 4. Equipment references
alter table public.equipment
  add column if not exists subsystem_type_id bigint,
  add column if not exists station_number text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema='public'
      and table_name='equipment'
      and constraint_name='equipment_subsystem_type_id_fk'
  ) then
    alter table public.equipment
      add constraint equipment_subsystem_type_id_fk
      foreign key (subsystem_type_id)
      references public.subsystem_types(id)
      on update cascade
      on delete set null;
  end if;
end $$;

-- backfill subsystem_type_id from legacy subsystem_id
update public.equipment e
set subsystem_type_id = st.id
from public.equipment_subsystems es
join public.subsystem_types st
  on st.code = upper(trim(es.name))
where e.subsystem_type_id is null
  and e.subsystem_id = es.id;

create index if not exists equipment_subsystem_type_id_idx
  on public.equipment(subsystem_type_id);
create index if not exists equipment_station_number_idx
  on public.equipment(station_number);

-- 5. Data integrity: chosen subsystem must be linked to selected system
create or replace function public.enforce_equipment_system_subtype()
returns trigger
language plpgsql
as $$
begin
  if new.system_id is not null and new.subsystem_type_id is not null then
    if not exists (
      select 1
      from public.system_subsystems ss
      where ss.system_id = new.system_id
        and ss.subsystem_type_id = new.subsystem_type_id
    ) then
      raise exception 'Subsystem type % is not linked to system %', new.subsystem_type_id, new.system_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_system_subtype on public.equipment;
create trigger trg_equipment_system_subtype
before insert or update of system_id, subsystem_type_id
on public.equipment
for each row
execute function public.enforce_equipment_system_subtype();

-- 6. Read policies for frontend dictionaries
alter table public.system_types enable row level security;
alter table public.subsystem_types enable row level security;
alter table public.system_subsystems enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='system_types' and policyname='system_types_read_all'
  ) then
    create policy system_types_read_all on public.system_types
      for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='subsystem_types' and policyname='subsystem_types_read_all'
  ) then
    create policy subsystem_types_read_all on public.subsystem_types
      for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='system_subsystems' and policyname='system_subsystems_read_all'
  ) then
    create policy system_subsystems_read_all on public.system_subsystems
      for select to anon, authenticated using (true);
  end if;
end $$;

-- 7. Remove temporary/legacy helper tables (no longer needed)
drop table if exists public.equipment_subsystem_catalog cascade;
drop table if exists public.equipment_system_subsystems cascade;

