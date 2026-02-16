-- Hardening unit scoping for personnel + workplaces + schedules + equipment.
-- Goal: remove cross-unit leakage and make filtering deterministic.
-- Run in Supabase SQL Editor.

begin;

-- 0) Common helper: infer unit from free text.
create or replace function public.infer_unit_from_text(p_text text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(lower(p_text), '') ~ '(котлотурбин|ктц|котель|турбин)' then 'ktc'
    when coalesce(lower(p_text), '') ~ '(хим)' then 'chem'
    when coalesce(lower(p_text), '') ~ '(электро)' then 'electro'
    when coalesce(lower(p_text), '') ~ '(автомат|кип|измер)' then 'sai'
    when coalesce(lower(p_text), '') ~ '(топлив)' then 'fuel'
    else null
  end;
$$;

-- 1) Add explicit unit columns where needed.
alter table if exists public.positions add column if not exists unit text;
alter table if exists public.employees add column if not exists unit text;
alter table if exists public.equipment add column if not exists unit text;

-- 2) Workplaces: force unit ownership.
update public.workplace w
set unit = coalesce(
  nullif(trim(w.unit), ''),
  public.infer_unit_from_text(concat_ws(' ', w.code, w.name, w.description, w.position_id, w.departament_id)),
  'ktc'
)
where w.unit is null or btrim(w.unit) = '';

alter table if exists public.workplace alter column unit set default 'ktc';
alter table if exists public.workplace alter column unit set not null;

-- 3) Positions: bind each position to a unit.
update public.positions p
set unit = coalesce(
  nullif(trim(p.unit), ''),
  public.infer_unit_from_text(concat_ws(' ', p.name, p.devision_name, p.departament_name)),
  'ktc'
)
where p.unit is null or btrim(p.unit) = '';

alter table if exists public.positions alter column unit set default 'ktc';
alter table if exists public.positions alter column unit set not null;

-- 4) Employees: primary source is positions.unit, fallback by own text.
update public.employees e
set unit = coalesce(
  nullif(trim(e.unit), ''),
  p.unit,
  public.infer_unit_from_text(concat_ws(' ', p.name, p.devision_name, p.departament_name)),
  'ktc'
)
from public.positions p
where e.position_id = p.id
  and (e.unit is null or btrim(e.unit) = '');

-- Extra fallback for employees without matching position.
update public.employees e
set unit = coalesce(
  nullif(trim(e.unit), ''),
  'ktc'
)
where e.unit is null or btrim(e.unit) = '';

alter table if exists public.employees alter column unit set default 'ktc';
alter table if exists public.employees alter column unit set not null;

-- 5) Schedules: enforce unit on both base schedule and overrides.
update public.schedule s
set unit = coalesce(
  nullif(trim(s.unit), ''),
  e.unit,
  'ktc'
)
from public.employees e
where s.employee_id = e.id
  and (s.unit is null or btrim(s.unit) = '');

update public.schedule
set unit = coalesce(nullif(trim(unit), ''), 'ktc')
where unit is null or btrim(unit) = '';

alter table if exists public.schedule alter column unit set default 'ktc';
alter table if exists public.schedule alter column unit set not null;

update public.schedule_overrides so
set unit = coalesce(
  nullif(trim(so.unit), ''),
  e.unit,
  'ktc'
)
from public.employees e
where so.employee_id = e.id
  and (so.unit is null or btrim(so.unit) = '');

update public.schedule_overrides
set unit = coalesce(nullif(trim(unit), ''), 'ktc')
where unit is null or btrim(unit) = '';

alter table if exists public.schedule_overrides alter column unit set default 'ktc';
alter table if exists public.schedule_overrides alter column unit set not null;

-- 6) Equipment: bind unit explicitly.
-- 6.1) First try to infer from workplace mapping by control point.
with wp_norm as (
  select
    w.unit,
    lower(replace(replace(coalesce(w.code, ''), '_', ''), ' ', '')) as code_norm,
    lower(replace(replace(coalesce(w.name, ''), '_', ''), ' ', '')) as name_norm
  from public.workplace w
),
eq_norm as (
  select
    e.id,
    lower(replace(replace(coalesce(e.control_point::text, ''), '_', ''), ' ', '')) as cp_norm
  from public.equipment e
  where e.unit is null or btrim(e.unit) = ''
)
update public.equipment e
set unit = w.unit
from eq_norm q
join wp_norm w
  on q.cp_norm <> ''
 and (q.cp_norm = w.code_norm or q.cp_norm = w.name_norm)
where e.id = q.id
  and (e.unit is null or btrim(e.unit) = '');

-- 6.2) Fallback mapping for known KTC control points.
update public.equipment
set unit = 'ktc'
where (unit is null or btrim(unit) = '')
  and (
    control_point::text in (
      'нс_ктц',
      'ст_машинист_по_ко',
      'цтщупк_1',
      'цтщупк_2',
      'цтщупк_3',
      'машинист_обходчик_6р_по_ко',
      'машинист_обходчик_5р_по_ко',
      'машинист_обходчик_4р_по_ко',
      'ст_машинист_по_то',
      'цтщупт_1',
      'цтщупт_2',
      'цтщупт_3',
      'цтщупт_4',
      'машинист_обходчик_5р_по_то',
      'машинист_обходчик_4р_по_то'
    )
    or upper(coalesce(equipment_system, '')) similar to '(ТА|КА)%'
  );

-- 6.3) Final fallback.
update public.equipment
set unit = coalesce(nullif(trim(unit), ''), 'ktc')
where unit is null or btrim(unit) = '';

alter table if exists public.equipment alter column unit set default 'ktc';
alter table if exists public.equipment alter column unit set not null;

-- 7) Useful indexes for all unit filters in frontend and RPCs.
create index if not exists idx_positions_unit on public.positions(unit);
create index if not exists idx_employees_unit on public.employees(unit);
create index if not exists idx_workplace_unit on public.workplace(unit);
create index if not exists idx_schedule_unit_date on public.schedule(unit, date);
create index if not exists idx_schedule_overrides_unit_date on public.schedule_overrides(unit, date);
create index if not exists idx_equipment_unit on public.equipment(unit);

commit;
