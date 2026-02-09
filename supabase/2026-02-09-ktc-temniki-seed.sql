-- KTC daily briefing themes + round themes (1..30)
-- Requires tables from 2026-02-09-shift-rounds-module.sql

DO $$
BEGIN
  IF to_regclass('public.briefing_topics') IS NULL THEN
    RAISE EXCEPTION 'Table public.briefing_topics not found. Apply 2026-02-09-shift-rounds-module.sql first.';
  END IF;
  IF to_regclass('public.inspection_items') IS NULL THEN
    RAISE EXCEPTION 'Table public.inspection_items not found. Apply 2026-02-09-shift-rounds-module.sql first.';
  END IF;
  IF to_regclass('public.round_plans') IS NULL OR to_regclass('public.round_plan_items') IS NULL THEN
    RAISE EXCEPTION 'Round plan tables not found. Apply 2026-02-09-shift-rounds-module.sql first.';
  END IF;
END $$;

WITH src(day_num, briefing_topic, round_topic) AS (
  VALUES
    (1, 'Организационные мероприятия при допуске по наряду.', 'Заземление механизмов (вентиляторы и двигатели на своей установке).'),
    (2, 'Базовые и кардинальные принципы безопасности.', 'Проверка состояния и наличия СИЗ органов слуха у себя и других работников.'),
    (3, 'СИЗ. Использование, назначение.', 'Состояние розеток (надписи, целостность).'),
    (4, 'Требования безопасности к маршрутам движения персонала.', 'Содержание рабочего места в соответствии с методологией 5S.'),
    (5, 'Группы основных знаков безопасности.', 'Знаки безопасности (наличие, состояние).'),
    (6, 'Требования к защитным кожухам.', 'Состояние кожухов.'),
    (7, 'Устройство порошкового огнетушителя, правила приведения его в действие.', 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).'),
    (8, 'Требования охраны труда при обходах и осмотрах оборудования.', 'Состояние проходов (не загромождены).'),
    (9, 'Правила освобождения пострадавшего от действия электрического тока.', 'Провода (изоляция, отсутствие свисающих).'),
    (10, 'Правила безопасности при проведении огневых работ.', 'Состояние электросборок 380/220 В (наличие надписей, знаков, схем, заземлений).'),
    (11, 'Правила безопасности при обслуживании оборудования.', 'Ограждающие конструкции, площадки (наличие, исправность).'),
    (12, 'Требования безопасности к маршрутам движения персонала.', 'Перекрытия дренажных каналов (как закреплены, отсутствие коррозии, рифление).'),
    (13, 'Правила безопасности при работе на высоте.', 'Надписи, диспетчерские наименования арматуры (наличие, состояние).'),
    (14, 'Действия работника при выбросе хлора.', 'Противогазы (наличие дежурных, проверка личных, протирание).'),
    (15, 'Опасные и вредные производственные факторы на рабочем месте.', 'Документация: ДИ, смежных цехов, станционные (наличие, актуальность, перечень).'),
    (16, 'Правила безопасности при движении по участкам с недостаточной освещённостью.', 'Достаточная освещённость в цехе на рабочих местах.'),
    (17, 'Правила безопасности при движении по лестницам.', 'Состояние лестниц.'),
    (18, 'Ответственность производителя работ, членов бригады.', 'Манометры и уставки (калибровка, поверка, бирка, правильность работы).'),
    (19, 'Чем опасен электрический ток и приближение к токоведущим частям.', 'Кнопки аварийного отключения насоса (наличие пломбы).'),
    (20, 'Безопасное перемещение грузов.', 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).'),
    (21, 'Правила безопасности при обслуживании механизмов.', 'Насосы (режим работы, температура подшипников, вибрация, шум).'),
    (22, 'Что обязан проходить работник в процессе работы.', 'Содержание рабочего места в соответствии с методологией 5S.'),
    (23, 'Действия персонала при несчастном случае.', 'Аптечка (срок годности, перечень, препараты).'),
    (24, 'Базовые принципы культуры безопасности.', 'Документация: ПИ (наличие, актуальность, перечень).'),
    (25, 'Требования к пожарным кранам.', 'Проверка пожарных кранов (наличие пломбы, надписи телефона пожарной части, состояние вентиля).'),
    (26, 'Тематика инструктажа по рекомендации «Сигнала тревоги».', 'Мониторы (правильная работа, отсутствие зависаний).'),
    (27, 'Ответственность допускающего.', 'Состояние кожухов.'),
    (28, 'Действия персонала при пожаре.', 'Документация по охране труда (наличие, актуальность, перечень).'),
    (29, 'Требования ПБ к содержанию территории.', 'Заземление механизмов (вентиляторы и двигатели на своей установке).'),
    (30, 'Необходимость применения СИЗ.', 'Проверка состояния и наличия каски с подбородочным ремнём.')
), bounds AS (
  SELECT
    date_trunc('month', current_date)::date AS month_start,
    EXTRACT(day FROM (date_trunc('month', current_date) + interval '1 month -1 day'))::int AS month_days
), days AS (
  SELECT
    s.day_num,
    s.briefing_topic,
    s.round_topic,
    (b.month_start + (s.day_num - 1) * interval '1 day')::date AS plan_date
  FROM src s
  CROSS JOIN bounds b
  WHERE s.day_num <= b.month_days
)
INSERT INTO public.briefing_topics (unit, month, briefing_date, topic, materials, is_mandatory)
SELECT
  'ktc' AS unit,
  date_trunc('month', d.plan_date)::date AS month,
  d.plan_date AS briefing_date,
  d.briefing_topic AS topic,
  'Тема обхода: ' || d.round_topic AS materials,
  true AS is_mandatory
FROM days d
ON CONFLICT (unit, briefing_date)
DO UPDATE SET
  topic = EXCLUDED.topic,
  materials = EXCLUDED.materials,
  is_mandatory = EXCLUDED.is_mandatory;

WITH src(day_num, round_topic) AS (
  VALUES
    (1, 'Заземление механизмов (вентиляторы и двигатели на своей установке).'),
    (2, 'Проверка состояния и наличия СИЗ органов слуха у себя и других работников.'),
    (3, 'Состояние розеток (надписи, целостность).'),
    (4, 'Содержание рабочего места в соответствии с методологией 5S.'),
    (5, 'Знаки безопасности (наличие, состояние).'),
    (6, 'Состояние кожухов.'),
    (7, 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).'),
    (8, 'Состояние проходов (не загромождены).'),
    (9, 'Провода (изоляция, отсутствие свисающих).'),
    (10, 'Состояние электросборок 380/220 В (наличие надписей, знаков, схем, заземлений).'),
    (11, 'Ограждающие конструкции, площадки (наличие, исправность).'),
    (12, 'Перекрытия дренажных каналов (как закреплены, отсутствие коррозии, рифление).'),
    (13, 'Надписи, диспетчерские наименования арматуры (наличие, состояние).'),
    (14, 'Противогазы (наличие дежурных, проверка личных, протирание).'),
    (15, 'Документация: ДИ, смежных цехов, станционные (наличие, актуальность, перечень).'),
    (16, 'Достаточная освещённость в цехе на рабочих местах.'),
    (17, 'Состояние лестниц.'),
    (18, 'Манометры и уставки (калибровка, поверка, бирка, правильность работы).'),
    (19, 'Кнопки аварийного отключения насоса (наличие пломбы).'),
    (20, 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).'),
    (21, 'Насосы (режим работы, температура подшипников, вибрация, шум).'),
    (22, 'Содержание рабочего места в соответствии с методологией 5S.'),
    (23, 'Аптечка (срок годности, перечень, препараты).'),
    (24, 'Документация: ПИ (наличие, актуальность, перечень).'),
    (25, 'Проверка пожарных кранов (наличие пломбы, надписи телефона пожарной части, состояние вентиля).'),
    (26, 'Мониторы (правильная работа, отсутствие зависаний).'),
    (27, 'Состояние кожухов.'),
    (28, 'Документация по охране труда (наличие, актуальность, перечень).'),
    (29, 'Заземление механизмов (вентиляторы и двигатели на своей установке).'),
    (30, 'Проверка состояния и наличия каски с подбородочным ремнём.')
)
INSERT INTO public.inspection_items (code, name, description, category, unit, is_active)
SELECT
  'ktc-daily-' || lpad(src.day_num::text, 3, '0') AS code,
  src.round_topic AS name,
  'Ежедневный обход ТО КТЦ · день ' || src.day_num::text AS description,
  'daily_round' AS category,
  'ktc' AS unit,
  true AS is_active
FROM src
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active;

WITH src(day_num, round_code) AS (
  SELECT g, 'ktc-daily-' || lpad(g::text, 3, '0')
  FROM generate_series(1, 30) g
), bounds AS (
  SELECT
    date_trunc('month', current_date)::date AS month_start,
    EXTRACT(day FROM (date_trunc('month', current_date) + interval '1 month -1 day'))::int AS month_days
), days AS (
  SELECT
    s.day_num,
    s.round_code,
    (b.month_start + (s.day_num - 1) * interval '1 day')::date AS plan_date
  FROM src s
  CROSS JOIN bounds b
  WHERE s.day_num <= b.month_days
), upsert_plans AS (
  INSERT INTO public.round_plans (plan_date, unit, briefing_topic_id, created_by)
  SELECT d.plan_date, 'ktc', NULL, NULL
  FROM days d
  ON CONFLICT (plan_date, unit) DO NOTHING
  RETURNING id, plan_date
), plans AS (
  SELECT id, plan_date FROM upsert_plans
  UNION ALL
  SELECT rp.id, rp.plan_date
  FROM public.round_plans rp
  JOIN days d ON d.plan_date = rp.plan_date
  WHERE rp.unit = 'ktc'
)
INSERT INTO public.round_plan_items (plan_id, item_id, sort_order, required)
SELECT
  p.id AS plan_id,
  ii.id AS item_id,
  10 AS sort_order,
  true AS required
FROM plans p
JOIN days d ON d.plan_date = p.plan_date
JOIN public.inspection_items ii ON ii.code = d.round_code
ON CONFLICT (plan_id, item_id) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    required = EXCLUDED.required;
