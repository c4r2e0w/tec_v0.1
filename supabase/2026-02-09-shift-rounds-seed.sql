-- Seed for workplaces, briefing topics, inspection items, and today's round plan

-- Workplaces (KTC)
insert into public.workplace (code, unit, name, description, position_id, departament_id, is_active)
values
  ('ktc-chief', 'ktc', 'НС КТЦ', 'Начальник смены КТЦ', 'Начальник смены котло-турбинного цеха', null, true),
  ('ktc-boiler-senior', 'ktc', 'Ст. машинист КО', 'Старший машинист котельного отделения', 'Старший машинист 7 разряда по котельному отделению', 'Котельное отделение', true),
  ('ktc-boiler-panel-1', 'ktc', 'ЦТЩУпк 1', 'Щит котельного отделения №1', 'Машинист центрального теплового щита управления котельным агрегатом  7 разряда', 'Котельное отделение', true),
  ('ktc-boiler-panel-2', 'ktc', 'ЦТЩУпк 2', 'Щит котельного отделения №2', 'Машинист центрального теплового щита управления котельным агрегатом  7 разряда', 'Котельное отделение', true),
  ('ktc-boiler-walker', 'ktc', 'Обход КО', 'Обходчик котельного отделения', 'Машинист обходчик по котельному отделению 5 разряда', 'Котельное отделение', true),
  ('ktc-turbine-senior', 'ktc', 'Ст. машинист ТО', 'Старший машинист турбинного отделения', 'Старший машинист 7 разряда по турбинному отделению', 'Турбинное отделение', true),
  ('ktc-turbine-panel-1', 'ktc', 'ЦТЩУпт 1', 'Щит турбинного отделения №1', 'Машинист центрального теплового щита управления паровыми турбинами 7 разряда', 'Турбинное отделение', true),
  ('ktc-turbine-panel-2', 'ktc', 'ЦТЩУпт 2', 'Щит турбинного отделения №2', 'Машинист центрального теплового щита управления паровыми турбинами 7 разряда', 'Турбинное отделение', true),
  ('ktc-turbine-walker', 'ktc', 'Обход ТО', 'Обходчик турбинного отделения', 'Машинист обходчик по турбинному отделению 5 разряда', 'Турбинное отделение', true)
on conflict (code) do update set
  unit = excluded.unit,
  name = excluded.name,
  description = excluded.description,
  position_id = excluded.position_id,
  departament_id = excluded.departament_id,
  is_active = excluded.is_active;

-- Briefing topics for current month (1..30)
with month_start as (
  select date_trunc('month', current_date)::date as d
),
days as (
  select (d + (g.n - 1) * interval '1 day')::date as day_date,
         g.n as n,
         d as month
  from month_start, generate_series(1, 30) as g(n)
)
insert into public.briefing_topics (unit, month, briefing_date, topic, materials, is_mandatory)
select
  'ktc' as unit,
  days.month,
  days.day_date,
  format('Тема пятиминутки №%s', days.n),
  format('Материалы: чек-лист безопасности, тема %s', days.n),
  true
from days
on conflict (unit, briefing_date)
do update set
  topic = excluded.topic,
  materials = excluded.materials,
  is_mandatory = excluded.is_mandatory;

-- Inspection items
insert into public.inspection_items (code, name, description, category, unit, is_active)
values
  ('ktc-daily-001', 'Проверка состояния щитов управления', 'Осмотр щитовых, сигнализация, аварийные лампы', 'daily_round', 'ktc', true),
  ('ktc-daily-002', 'Проверка параметров котлов', 'Температура, давление, отклонения от уставок', 'daily_round', 'ktc', true),
  ('ktc-daily-003', 'Проверка параметров турбин', 'Вибрация, температура масла, утечки', 'daily_round', 'ktc', true),
  ('ktc-daily-004', 'Обход насосного оборудования', 'Шумы, вибрация, протечки, смазка', 'daily_round', 'ktc', true),
  ('ktc-daily-005', 'Проверка пожарной безопасности', 'Проходы, огнетушители, сигнализация', 'safety', 'ktc', true),
  ('ktc-daily-006', 'Проверка СИЗ и допуска персонала', 'Наличие СИЗ, актуальность допусков', 'safety', 'ktc', true),
  ('ktc-daily-007', 'Проверка системы связи', 'Связь между щитами и обходчиками', 'operations', 'ktc', true),
  ('ktc-daily-008', 'Контроль чистоты и порядка', 'Состояние рабочих мест и проходов', 'housekeeping', 'ktc', true),
  ('ktc-daily-009', 'Проверка журналов и записей', 'Актуальность записей в оперативном журнале', 'documentation', 'ktc', true),
  ('ktc-daily-010', 'Контроль замечаний прошлой смены', 'Проверка закрытия замечаний и предписаний', 'followup', 'ktc', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  unit = excluded.unit,
  is_active = excluded.is_active;

-- Plan for today
insert into public.round_plans (plan_date, unit, briefing_topic_id, created_by)
select
  current_date,
  'ktc',
  bt.id,
  null
from public.briefing_topics bt
where bt.unit = 'ktc'
  and bt.briefing_date = current_date
limit 1
on conflict (plan_date, unit) do nothing;

insert into public.round_plan_items (plan_id, item_id, sort_order, required)
select
  rp.id,
  ii.id,
  row_number() over(order by ii.id),
  true
from public.round_plans rp
join public.inspection_items ii on ii.unit = 'ktc' and ii.is_active = true
where rp.plan_date = current_date
  and rp.unit = 'ktc'
on conflict (plan_id, item_id) do nothing;
