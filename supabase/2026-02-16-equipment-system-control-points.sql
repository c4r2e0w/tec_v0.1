-- Cross-table for valid control points by equipment system.
-- Allows multiple control points per system (e.g., TA-4, Heat Network).
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.equipment_system_control_points (
  id bigserial primary key,
  system_id bigint not null references public.equipment_systems(id) on delete cascade,
  control_point text not null,
  unique (system_id, control_point)
);

create index if not exists idx_equipment_system_control_points_system
  on public.equipment_system_control_points(system_id);

-- Seed link table from existing equipment rows.
insert into public.equipment_system_control_points (system_id, control_point)
select distinct
  e.system_id,
  e.control_point::text
from public.equipment e
where e.system_id is not null
  and e.control_point is not null
on conflict (system_id, control_point) do nothing;

-- Optional: validate equipment row against allowed control points for system.
create or replace function public.enforce_equipment_system_control_point()
returns trigger
language plpgsql
as $$
begin
  if new.system_id is not null and new.control_point is not null then
    if not exists (
      select 1
      from public.equipment_system_control_points escp
      where escp.system_id = new.system_id
        and escp.control_point = new.control_point::text
    ) then
      raise exception 'Control point % is not linked to system %', new.control_point, new.system_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_system_control_point on public.equipment;
create trigger trg_equipment_system_control_point
before insert or update of system_id, control_point
on public.equipment
for each row
execute function public.enforce_equipment_system_control_point();

-- Read policy for frontend.
alter table public.equipment_system_control_points enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipment_system_control_points'
      and policyname = 'equipment_system_control_points_select_all'
  ) then
    create policy equipment_system_control_points_select_all
      on public.equipment_system_control_points
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

commit;
