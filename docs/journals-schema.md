# Журналы, директивы и дефекты

Рабочая схема для «журналов» (директивы, дефекты, суточные ведомости и др.) в Supabase/Postgres. Вся логика умещается в четыре таблицы + триггер для автора и RLS.

## Схема связей
```
journals ──< entries ──< entry_receipts
                  └─< entry_reads

profiles ──< entries.created_by_profile_id
employees ─< entries.created_by_employee_id ─< positions
```

## Таблицы
- `journals(id serial PK, code text unique, name text, description text)`
- `entries(id uuid PK default gen_random_uuid(), journal_id int FK→journals, title text, body text, type text, status text, unit text|int FK, created_at timestamptz default now(), created_by_profile_id uuid FK→profiles, created_by_employee_id int FK→employees, tags jsonb default '[]', attachments jsonb, author_snapshot jsonb)`
- `entry_receipts(entry_id uuid FK→entries, profile_id uuid FK→profiles, acknowledged_at timestamptz default now(), primary key(entry_id, profile_id))`
- `entry_reads(profile_id uuid FK→profiles, journal_id int FK→journals, last_seen_at timestamptz default now(), primary key(profile_id, journal_id))`
- Дополнительно (если нужно быстро фильтровать по коду журнала) в `entries` можно держать денормализованное поле `journal_code text`, которое триггером копируется из `journals.code` на insert.

## Мини DDL (Postgres)
```sql
create table if not exists journals (
  id serial primary key,
  code text unique not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  journal_id int not null references journals(id) on delete cascade,
  title text not null,
  body text,
  type text,
  status text default 'open',
  unit text, -- или unit_id int references units(id)
  created_at timestamptz default now(),
  created_by_profile_id uuid references profiles(id),
  created_by_employee_id int references employees(id),
  tags jsonb default '[]'::jsonb,
  attachments jsonb,
  author_snapshot jsonb
);

create table if not exists entry_receipts (
  entry_id uuid references entries(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  acknowledged_at timestamptz default now(),
  primary key(entry_id, profile_id)
);

create table if not exists entry_reads (
  profile_id uuid references profiles(id) on delete cascade,
  journal_id int references journals(id) on delete cascade,
  last_seen_at timestamptz default now(),
  primary key(profile_id, journal_id)
);
```

## Триггеры / edge functions
- Автозаполнение автора: на `entries` `BEFORE INSERT` ставим `created_by_profile_id = auth.uid()`, `created_by_employee_id = profiles.employee_id` и опционально `author_snapshot` с ФИО/должностью.
- Если используем `journal_code` в `entries`, в том же триггере подтягиваем `journals.code` по `journal_id`.
- Триггер пишем как `SECURITY DEFINER`, `search_path = public`, и не даём клиенту переопределять автора через `with check`.

Пример заготовки:
```sql
create or replace function set_entry_author() returns trigger as $$
declare
  prof record;
begin
  select p.id, p.employee_id,
         jsonb_build_object(
           'profile_id', p.id,
           'employee_id', p.employee_id,
           'full_name', e.last_name || ' ' || e.first_name || coalesce(' '||e.middle_name, ''),
           'position', pos.name
         ) as snap
  into prof
  from profiles p
  left join employees e on e.id = p.employee_id
  left join positions pos on pos.id = e.position_id
  where p.id = auth.uid();

  new.created_by_profile_id := prof.id;
  new.created_by_employee_id := prof.employee_id;
  new.author_snapshot := prof.snap;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_entries_set_author before insert on entries
for each row execute function set_entry_author();
```

## RLS политики (включить RLS на `entries`, `entry_receipts`, `entry_reads`)
- `entries`:
  - SELECT: `using (auth.role() = 'authenticated' and entry_unit_is_allowed_for_user(auth.uid(), unit))`
  - INSERT: `with check (auth.uid() = created_by_profile_id)`
  - UPDATE/DELETE: `using (created_by_profile_id = auth.uid() or is_admin(auth.uid()))`
- `entry_receipts`:
  - SELECT: `using (profile_id = auth.uid())`
  - INSERT: `with check (profile_id = auth.uid())`
- `entry_reads`:
  - SELECT: `using (profile_id = auth.uid())`
  - INSERT/UPDATE: `with check (profile_id = auth.uid())`
- Нужны вспомогательные функции `entry_unit_is_allowed_for_user` и `is_admin`, которые смотрят на профиль/роль и доступные unit/section.

## Индексы
- `entries(journal_id, created_at)`
- `entries(created_by_profile_id)`
- `entries(unit)` или FK на справочник цехов
- `entry_receipts(entry_id, profile_id) unique`
- `entry_reads(profile_id, journal_id) unique`
- GIN: `entries using gin(tags)` и/или полнотекст по `title, body` если нужен поиск.

## Подсчёт «новых» записей и ознакомлений
```sql
-- Кол-во новых для профиля X в журнале Y
select count(*) as new_count
from entries e
left join entry_receipts r
  on r.entry_id = e.id and r.profile_id = :profile_id
left join entry_reads rd
  on rd.journal_id = e.journal_id and rd.profile_id = :profile_id
where e.journal_id = :journal_id
  and r.profile_id is null
  and e.created_at > coalesce(rd.last_seen_at, 'epoch');
```
- Кнопка «Ознакомлен» → upsert в `entry_receipts`.
- Кнопка «Все прочитано» → upsert в `entry_reads` с `last_seen_at = now()`.

## Типы журналов и данные
- Журнал = строка в `journals` (`code` например `directive`, `defect`, `daily` или `ktc-docs`).
- Подтип/тематика внутри журнала — `entries.type` (`admin|turbine|boiler` и т.д.) + теги в `entries.tags`.
- Пример наполнения:
```sql
insert into journals (code, name) values
  ('directive', 'Директивы'),
  ('defect', 'Дефекты'),
  ('daily', 'Суточные ведомости')
on conflict (code) do nothing;
```

## UI-акценты
- Вкладки/фильтры по `journals.code`; бейдж «новое» считает по запросу выше.
- Карточка записи всегда выводит автора через `author_snapshot` или join `profiles → employees → positions`.
- Фильтры: журнал, unit/section, type, tags, статус; кнопки «Ознакомлен» и «Все прочитано».

