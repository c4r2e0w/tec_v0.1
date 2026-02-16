-- Normalized architecture for equipment:
-- 1) subsystem catalog without duplication across systems
-- 2) explicit links system <-> subsystem
-- 3) equipment keeps selected system + subsystem + station_number

create table if not exists public.equipment_subsystem_catalog (
  id bigserial primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists equipment_subsystem_catalog_name_uq
  on public.equipment_subsystem_catalog (upper(trim(name)));

create table if not exists public.equipment_system_subsystems (
  id bigserial primary key,
  system_id bigint not null references public.equipment_systems(id) on delete cascade,
  subsystem_catalog_id bigint not null references public.equipment_subsystem_catalog(id) on delete cascade,
  display_order integer not null default 0
);

create unique index if not exists equipment_system_subsystems_uq
  on public.equipment_system_subsystems (system_id, subsystem_catalog_id);

alter table public.equipment
  add column if not exists system_id bigint,
  add column if not exists subsystem_catalog_id bigint,
  add column if not exists station_number text;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'equipment'
      and constraint_name = 'equipment_system_id_fk'
  ) then
    alter table public.equipment
      add constraint equipment_system_id_fk
      foreign key (system_id) references public.equipment_systems(id)
      on update cascade on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'equipment'
      and constraint_name = 'equipment_subsystem_catalog_id_fk'
  ) then
    alter table public.equipment
      add constraint equipment_subsystem_catalog_id_fk
      foreign key (subsystem_catalog_id) references public.equipment_subsystem_catalog(id)
      on update cascade on delete set null;
  end if;
end $$;

create index if not exists equipment_system_id_idx on public.equipment(system_id);
create index if not exists equipment_subsystem_catalog_id_idx on public.equipment(subsystem_catalog_id);
create index if not exists equipment_station_number_idx on public.equipment(station_number);

-- Fill catalog from existing denormalized subsystem table.
insert into public.equipment_subsystem_catalog (name, description)
select
  upper(trim(es.name)) as name,
  max(nullif(trim(es.description), '')) as description
from public.equipment_subsystems es
where nullif(trim(es.name), '') is not null
group by upper(trim(es.name))
on conflict ((upper(trim(name)))) do update
set description = coalesce(public.equipment_subsystem_catalog.description, excluded.description);

-- Fill system<->subsystem links.
insert into public.equipment_system_subsystems (system_id, subsystem_catalog_id)
select distinct
  sys.id as system_id,
  cat.id as subsystem_catalog_id
from public.equipment_subsystems es
join public.equipment_systems sys
  on upper(trim(sys.name)) = upper(trim(es.system))
join public.equipment_subsystem_catalog cat
  on upper(trim(cat.name)) = upper(trim(es.name))
on conflict (system_id, subsystem_catalog_id) do nothing;

-- Fill equipment normalized references from old fields.
update public.equipment e
set system_id = sys.id
from public.equipment_systems sys
where e.system_id is null
  and upper(trim(e.equipment_system)) = upper(trim(sys.name));

update public.equipment e
set subsystem_catalog_id = cat.id
from public.equipment_subsystems es
join public.equipment_subsystem_catalog cat
  on upper(trim(cat.name)) = upper(trim(es.name))
where e.subsystem_catalog_id is null
  and e.subsystem_id = es.id;

update public.equipment
set station_number = nullif(trim(name), '')
where station_number is null;

-- Ensure selected subsystem belongs to selected system.
create or replace function public.enforce_equipment_system_subsystem()
returns trigger
language plpgsql
as $$
begin
  if new.system_id is not null and new.subsystem_catalog_id is not null then
    if not exists (
      select 1
      from public.equipment_system_subsystems ess
      where ess.system_id = new.system_id
        and ess.subsystem_catalog_id = new.subsystem_catalog_id
    ) then
      raise exception 'Subsystem % is not linked to system %', new.subsystem_catalog_id, new.system_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_system_subsystem_check on public.equipment;
create trigger trg_equipment_system_subsystem_check
before insert or update of system_id, subsystem_catalog_id
on public.equipment
for each row
execute function public.enforce_equipment_system_subsystem();

-- Read access for frontend dictionaries.
alter table public.equipment_subsystem_catalog enable row level security;
alter table public.equipment_system_subsystems enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='equipment_subsystem_catalog' and policyname='equipment_subsystem_catalog_read_all'
  ) then
    create policy equipment_subsystem_catalog_read_all
      on public.equipment_subsystem_catalog
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='equipment_system_subsystems' and policyname='equipment_system_subsystems_read_all'
  ) then
    create policy equipment_system_subsystems_read_all
      on public.equipment_system_subsystems
      for select to anon, authenticated
      using (true);
  end if;
end $$;

