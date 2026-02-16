-- Control point enum directly on equipment.
-- Run in Supabase SQL Editor.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_control_point') then
    create type public.equipment_control_point as enum (
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
    );
  end if;
end $$;

alter table public.equipment
  add column if not exists control_point public.equipment_control_point;

create index if not exists equipment_control_point_idx
  on public.equipment (control_point);

-- Base auto-fill by equipment system
update public.equipment
set control_point = case
  when equipment_system ~* '^ТА\\s*1$' then 'цтщупт_1'::public.equipment_control_point
  when equipment_system ~* '^ТА\\s*2$' then 'цтщупт_2'::public.equipment_control_point
  when equipment_system ~* '^ТА\\s*3$' then 'цтщупт_3'::public.equipment_control_point
  when equipment_system ~* '^ТА\\s*4$' then 'цтщупт_4'::public.equipment_control_point
  when equipment_system ~* '^КА\\s*1$' then 'цтщупк_1'::public.equipment_control_point
  when equipment_system ~* '^КА\\s*2$' then 'цтщупк_2'::public.equipment_control_point
  when equipment_system ~* '^КА\\s*3$' then 'цтщупк_3'::public.equipment_control_point
  else control_point
end
where control_point is null;

-- Explicit exceptions from operations
update public.equipment
set control_point = 'цтщупт_1'::public.equipment_control_point
where name ~* 'ПЭН\\s*1' or name ~* 'ПЭН\\s*2';

update public.equipment
set control_point = 'цтщупт_2'::public.equipment_control_point
where name ~* 'ПЭН\\s*4';

