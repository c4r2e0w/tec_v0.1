-- MVP: приемка смены, темы инструктажей, назначения и временные права.

create extension if not exists pgcrypto;

create table if not exists public.briefing_topics (
  id bigserial primary key,
  unit text not null,
  month date not null,
  briefing_date date,
  topic text not null,
  materials text,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_briefing_topic_per_day
  on public.briefing_topics(unit, briefing_date)
  where briefing_date is not null;

create index if not exists idx_briefing_topics_month
  on public.briefing_topics(unit, month);

create table if not exists public.shift_sessions (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  shift_date date not null,
  shift_type text not null default 'day',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'handover', -- planned | handover | active | closed
  chief_employee_id int references public.employees(id) on delete set null,
  briefing_topic_id bigint references public.briefing_topics(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shift_session
  on public.shift_sessions(unit, shift_date, shift_type);

create index if not exists idx_shift_sessions_status
  on public.shift_sessions(unit, shift_date, status);

create table if not exists public.shift_assignments (
  id bigserial primary key,
  session_id uuid not null references public.shift_sessions(id) on delete cascade,
  employee_id int not null references public.employees(id) on delete cascade,
  workplace_code text not null,
  position_name text,
  source text not null default 'schedule', -- schedule | manual
  is_present boolean not null default true,
  note text,
  confirmed_by_chief boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shift_assignment_employee
  on public.shift_assignments(session_id, employee_id);

create index if not exists idx_shift_assignments_workplace
  on public.shift_assignments(session_id, workplace_code);

create table if not exists public.shift_permissions (
  id bigserial primary key,
  session_id uuid not null references public.shift_sessions(id) on delete cascade,
  employee_id int not null references public.employees(id) on delete cascade,
  scope text not null, -- daily_statement | operational_log | shift_control
  workplace_code text not null default '',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists uq_shift_permission
  on public.shift_permissions(session_id, employee_id, scope, workplace_code);

create index if not exists idx_shift_permissions_active
  on public.shift_permissions(employee_id, scope, revoked_at);
