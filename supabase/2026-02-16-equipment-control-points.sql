-- Equipment to workplace(control point) mapping
-- Run in Supabase SQL Editor

create table if not exists public.equipment_control_points (
  id bigserial primary key,
  equipment_id bigint not null references public.equipment(id) on delete cascade,
  workplace_id bigint not null references public.workplace(id) on delete cascade,
  is_primary boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists equipment_control_points_equipment_workplace_uidx
  on public.equipment_control_points (equipment_id, workplace_id);

create index if not exists equipment_control_points_workplace_idx
  on public.equipment_control_points (workplace_id, is_primary);

create index if not exists equipment_control_points_equipment_idx
  on public.equipment_control_points (equipment_id);

create or replace function public.touch_equipment_control_points_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_equipment_control_points_touch_updated_at on public.equipment_control_points;
create trigger trg_equipment_control_points_touch_updated_at
before update on public.equipment_control_points
for each row execute function public.touch_equipment_control_points_updated_at();

-- Optional bootstrap rules for KTC panels.
-- Review and adjust after first run.
insert into public.equipment_control_points (equipment_id, workplace_id, is_primary, note)
select
  e.id,
  w.id,
  true,
  'auto bootstrap by naming rule'
from public.equipment e
join public.workplace w on lower(w.code) = lower(
  case
    when e.name ~* 'ПЭН\\s*1|ПЭН\\s*2' then 'цтщупт_1'
    when e.name ~* 'ПЭН\\s*4' then 'цтщупт_2'
    when e.equipment_system ~* '^ТА\\s*1$' then 'цтщупт_1'
    when e.equipment_system ~* '^ТА\\s*2$' then 'цтщупт_2'
    when e.equipment_system ~* '^ТА\\s*3$' then 'цтщупт_3'
    when e.equipment_system ~* '^ТА\\s*4$' then 'цтщупт_4'
    when e.equipment_system ~* '^КА\\s*1$' then 'цтщупк_1'
    when e.equipment_system ~* '^КА\\s*2$' then 'цтщупк_2'
    when e.equipment_system ~* '^КА\\s*3$' then 'цтщупк_3'
    else null
  end
)
where
  case
    when e.name ~* 'ПЭН\\s*1|ПЭН\\s*2' then 'цтщупт_1'
    when e.name ~* 'ПЭН\\s*4' then 'цтщупт_2'
    when e.equipment_system ~* '^ТА\\s*1$' then 'цтщупт_1'
    when e.equipment_system ~* '^ТА\\s*2$' then 'цтщупт_2'
    when e.equipment_system ~* '^ТА\\s*3$' then 'цтщупт_3'
    when e.equipment_system ~* '^ТА\\s*4$' then 'цтщупт_4'
    when e.equipment_system ~* '^КА\\s*1$' then 'цтщупк_1'
    when e.equipment_system ~* '^КА\\s*2$' then 'цтщупк_2'
    when e.equipment_system ~* '^КА\\s*3$' then 'цтщупк_3'
    else null
  end is not null
on conflict (equipment_id, workplace_id) do nothing;

