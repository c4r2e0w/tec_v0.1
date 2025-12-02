# График работы и исключения

Минимальный набор таблиц для планирования смен, учёта отпусков/больничных, донорских, тренингов и переработок. Под Supabase/Postgres с RLS.

## Таблицы (DDL)
```sql
-- Справочник смен
create table if not exists shift_templates (
  id serial primary key,
  code text unique not null,
  name text not null,
  start_time time without time zone,
  end_time time without time zone,
  duration_hours numeric(5,2),
  night boolean default false,
  is_rotational boolean default false,
  description text
);

-- Паттерны ротаций (вахта, 2/2 и т.п.)
create table if not exists rotations (
  id serial primary key,
  name text,
  template_id int references shift_templates(id) on delete set null,
  pattern jsonb not null,            -- пример: ["D","D","N","N","Off","Off"]
  start_date date default current_date,
  timezone text default 'Asia/Irkutsk',
  unit text,
  description text
);

-- План по дням (одна строка на дату и сотрудника)
create table if not exists schedule (
  id bigserial primary key,
  employee_id int not null references employees(id) on delete cascade,
  date date not null,
  template_id int references shift_templates(id) on delete set null,
  start_time time without time zone,
  end_time time without time zone,
  planned_hours numeric(5,2),
  unit text,
  source text default 'manual',       -- manual | generated | rotation
  note text,
  created_at timestamptz default now(),
  created_by uuid references profiles(id),
  unique (employee_id, date)
);

-- Исключения / замены смен
create table if not exists schedule_overrides (
  id bigserial primary key,
  employee_id int not null references employees(id) on delete cascade,
  date date not null,
  kind text not null,                 -- vacation | sick | training | donor | comp_day_off | overtime | debt | holiday_work | other
  hours_delta numeric(5,2),
  start_time time without time zone,
  end_time time without time zone,
  comment text,
  doc_ref text,
  unit text,
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- Заявки на отсутствие (согласование)
create table if not exists absence_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id int not null references employees(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  kind text not null,                 -- vacation | sick | training | donor | comp_day_off | other
  status text not null default 'draft',  -- draft | approved | rejected
  approver_id int references employees(id),
  comment text,
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- Балансы часов по месяцам
create table if not exists time_balances (
  employee_id int not null references employees(id) on delete cascade,
  month date not null,                -- первое число месяца
  planned_hours numeric(6,2) default 0,
  worked_hours numeric(6,2) default 0,
  overtime_hours numeric(6,2) default 0,
  debt_hours numeric(6,2) default 0,
  updated_at timestamptz default now(),
  primary key (employee_id, month)
);
```

## Индексы
```sql
create index if not exists idx_schedule_date_unit on schedule(date, unit);
create index if not exists idx_schedule_employee_date on schedule(employee_id, date);
create index if not exists idx_overrides_employee_date on schedule_overrides(employee_id, date);
create index if not exists idx_absence_requests_employee on absence_requests(employee_id, status);
```

## Политики RLS (пример)
Включаем RLS:
```sql
alter table schedule enable row level security;
alter table schedule_overrides enable row level security;
alter table absence_requests enable row level security;
alter table time_balances enable row level security;
```

Вспомогательные функции (адаптируй под свои роли/юниты):
```sql
create or replace function is_admin(p_profile uuid) returns boolean language sql stable as $$
  select exists (select 1 from profiles p join roles r on r.id = p.role_id where p.id = p_profile and r.id = 'admin');
$$;

create or replace function is_supervisor(p_profile uuid) returns boolean language sql stable as $$
  select exists (select 1 from profiles p join roles r on r.id = p.role_id where p.id = p_profile and r.id in ('supervisor','admin'));
$$;

create or replace function schedule_unit_allowed(p_profile uuid, p_unit text) returns boolean language sql stable as $$
  -- Пример: любой аутентифицированный
  select auth.role() = 'authenticated';
  -- Подставь свою проверку по подразделению/цеху
$$;
```

Политики `schedule`:
```sql
create policy schedule_select on schedule
  for select using (auth.role() = 'authenticated' and schedule_unit_allowed(auth.uid(), unit));

create policy schedule_insert on schedule
  for insert with check (
    created_by = auth.uid()
    and schedule_unit_allowed(auth.uid(), unit)
  );

create policy schedule_update on schedule
  for update using (created_by = auth.uid() or is_supervisor(auth.uid()))
  with check (created_by = auth.uid() or is_supervisor(auth.uid()));

create policy schedule_delete on schedule
  for delete using (created_by = auth.uid() or is_supervisor(auth.uid()));
```

Политики `schedule_overrides`:
```sql
create policy overrides_select on schedule_overrides
  for select using (auth.role() = 'authenticated' and schedule_unit_allowed(auth.uid(), unit));

create policy overrides_insert on schedule_overrides
  for insert with check (created_by = auth.uid() and schedule_unit_allowed(auth.uid(), unit));

create policy overrides_update on schedule_overrides
  for update using (created_by = auth.uid() or is_supervisor(auth.uid()))
  with check (created_by = auth.uid() or is_supervisor(auth.uid()));

create policy overrides_delete on schedule_overrides
  for delete using (created_by = auth.uid() or is_supervisor(auth.uid()));
```

Политики `absence_requests`:
```sql
create policy absence_select on absence_requests
  for select using (
    auth.role() = 'authenticated'
    and (created_by = auth.uid() or is_supervisor(auth.uid()))
  );

create policy absence_insert on absence_requests
  for insert with check (created_by = auth.uid());

create policy absence_update on absence_requests
  for update using (created_by = auth.uid() or is_supervisor(auth.uid()))
  with check (created_by = auth.uid() or is_supervisor(auth.uid()));
```

Политики `time_balances` (только чтение для своих/супервизоров, управление у супервизоров/админов):
```sql
create policy balances_select on time_balances
  for select using (
    auth.role() = 'authenticated'
    and schedule_unit_allowed(auth.uid(), (select unit from employees e where e.id = employee_id))
  );

create policy balances_upsert on time_balances
  for all using (is_supervisor(auth.uid())) with check (is_supervisor(auth.uid()));
```

## Как использовать
- Генерируй базовый план в `schedule` (по шаблонам/ротациям).
- Любое отсутствие/переработка/донорский/учёба — запись в `schedule_overrides` с `kind` и, при необходимости, `hours_delta`.
- Заявки на отпуск/больничный/донорский — `absence_requests` (статусы менять супервизором).
- Баланс часов — периодический пересчёт в `time_balances`.

При необходимости поля `kind` можно заменить на enum-таблицы. Защиту по цехам/ролям реализуй в `schedule_unit_allowed`. Если фронт не присылает `created_by`, поставь в таблицах default `auth.uid()` или триггер.**
