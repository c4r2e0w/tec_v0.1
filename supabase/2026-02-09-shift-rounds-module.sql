-- Shift module extension + rounds/checks module (idempotent)

create extension if not exists pgcrypto;

-- 1) Extend workplace dictionary without breaking legacy fields
alter table if exists public.workplace
  add column if not exists code text,
  add column if not exists unit text,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;

create unique index if not exists uq_workplace_code on public.workplace(code) where code is not null;
create index if not exists idx_workplace_unit on public.workplace(unit);

-- Backfill code for legacy rows if empty
update public.workplace
set code = lower(regexp_replace(coalesce(name, 'wp_' || id::text), '[^a-zA-Zа-яА-Я0-9]+', '_', 'g'))
where code is null or btrim(code) = '';

-- 2) Extend shift_sessions to align with briefing semantics
alter table if exists public.shift_sessions
  add column if not exists leader_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists leader_employee_id int references public.employees(id) on delete set null,
  add column if not exists shift_template_id int references public.shift_templates(id) on delete set null;

create index if not exists idx_shift_sessions_leader on public.shift_sessions(leader_profile_id, shift_date);

-- 3) New dictionaries and plan/fact entities for rounds
create table if not exists public.inspection_items (
  id bigserial primary key,
  code text unique,
  name text not null,
  description text,
  category text,
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.round_plans (
  id bigserial primary key,
  plan_date date not null,
  unit text,
  briefing_topic_id bigint references public.briefing_topics(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_round_plans_date_unit on public.round_plans(plan_date, unit);

create table if not exists public.round_plan_items (
  id bigserial primary key,
  plan_id bigint not null references public.round_plans(id) on delete cascade,
  item_id bigint not null references public.inspection_items(id) on delete cascade,
  sort_order int not null default 100,
  required boolean not null default true,
  unique(plan_id, item_id)
);

create index if not exists idx_round_plan_items_plan on public.round_plan_items(plan_id, sort_order);

create table if not exists public.round_runs (
  id bigserial primary key,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by_employee_id int not null references public.employees(id) on delete cascade,
  run_date date not null,
  unit text,
  schedule_id bigint references public.schedule(id) on delete set null,
  shift_session_id uuid references public.shift_sessions(id) on delete set null,
  status text not null default 'draft', -- draft | submitted | approved | rejected
  comment text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_round_runs_owner_date on public.round_runs(created_by_profile_id, run_date desc);
create index if not exists idx_round_runs_unit_date on public.round_runs(unit, run_date desc);

create table if not exists public.round_run_checks (
  id bigserial primary key,
  run_id bigint not null references public.round_runs(id) on delete cascade,
  item_id bigint not null references public.inspection_items(id) on delete restrict,
  status text not null default 'na', -- ok | issue | na
  comment text,
  measured_value text,
  updated_at timestamptz not null default now(),
  unique(run_id, item_id)
);

create index if not exists idx_round_run_checks_run on public.round_run_checks(run_id);

create table if not exists public.round_run_files (
  id bigserial primary key,
  check_id bigint not null references public.round_run_checks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_round_run_files_check on public.round_run_files(check_id);

-- 4) Utility trigger for updated_at
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_round_runs_updated_at on public.round_runs;
create trigger trg_round_runs_updated_at
before update on public.round_runs
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_round_run_checks_updated_at on public.round_run_checks;
create trigger trg_round_run_checks_updated_at
before update on public.round_run_checks
for each row execute function public.tg_set_updated_at();

-- 5) RPC: create or get shift briefing (based on shift_sessions)
create or replace function public.create_or_get_shift_briefing(
  p_date date,
  p_unit text,
  p_shift_type text default 'day'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_employee_id int;
  v_template_id int;
  v_session_id uuid;
begin
  if v_profile_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select employee_id into v_employee_id
  from public.profiles
  where id = v_profile_id;

  if v_employee_id is null then
    raise exception 'PROFILE_NOT_LINKED';
  end if;

  select s.template_id
  into v_template_id
  from public.schedule s
  where s.employee_id = v_employee_id
    and s.date = p_date
    and (p_unit is null or s.unit = p_unit)
  limit 1;

  insert into public.shift_sessions (
    unit, shift_date, shift_type,
    status, leader_profile_id, leader_employee_id,
    chief_employee_id, shift_template_id
  )
  values (
    coalesce(p_unit, ''), p_date, coalesce(p_shift_type, 'day'),
    'draft', v_profile_id, v_employee_id,
    v_employee_id, v_template_id
  )
  on conflict (unit, shift_date, shift_type)
  do update set
    leader_profile_id = excluded.leader_profile_id,
    leader_employee_id = excluded.leader_employee_id,
    chief_employee_id = coalesce(public.shift_sessions.chief_employee_id, excluded.chief_employee_id),
    shift_template_id = coalesce(public.shift_sessions.shift_template_id, excluded.shift_template_id)
  returning id into v_session_id;

  insert into public.shift_assignments (
    session_id,
    employee_id,
    workplace_code,
    position_name,
    source,
    is_present
  )
  select
    v_session_id,
    s.employee_id,
    coalesce(w.code, 'general') as workplace_code,
    p.name as position_name,
    'schedule' as source,
    true as is_present
  from public.schedule s
  join public.employees e on e.id = s.employee_id
  left join public.positions p on p.id = e.position_id
  left join public.workplace w
    on lower(coalesce(w.position_id, '')) = lower(coalesce(p.name, ''))
   and (w.unit is null or w.unit = p_unit)
  where s.date = p_date
    and (p_unit is null or s.unit = p_unit)
    and coalesce(s.planned_hours, 0) > 0
  on conflict (session_id, employee_id) do nothing;

  return v_session_id;
end;
$$;

-- 6) RPC: confirm briefing
create or replace function public.confirm_shift_briefing(
  p_briefing_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_leader uuid;
begin
  if v_profile_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select leader_profile_id into v_leader
  from public.shift_sessions
  where id = p_briefing_id;

  if v_leader is null then
    raise exception 'BRIEFING_NOT_FOUND';
  end if;

  if v_leader <> v_profile_id then
    raise exception 'FORBIDDEN_NOT_LEADER';
  end if;

  update public.shift_sessions
  set
    status = 'active',
    confirmed_at = now(),
    confirmed_by = v_profile_id
  where id = p_briefing_id;

  update public.shift_assignments
  set
    confirmed_by_chief = true,
    confirmed_at = now()
  where session_id = p_briefing_id;

  update public.shift_permissions
  set revoked_at = now()
  where session_id = p_briefing_id
    and revoked_at is null;

  insert into public.shift_permissions (
    session_id,
    employee_id,
    scope,
    workplace_code,
    created_by
  )
  select
    sa.session_id,
    sa.employee_id,
    scope_map.scope,
    coalesce(sa.workplace_code, ''),
    v_profile_id
  from public.shift_assignments sa
  join lateral (
    select 'daily_statement'::text as scope
    union all
    select 'operational_log'
    where lower(coalesce(sa.position_name, '')) like '%машинист щита%'
       or lower(coalesce(sa.position_name, '')) like '%старший машинист%'
       or lower(coalesce(sa.position_name, '')) like '%начальник смены%'
    union all
    select 'shift_control'
    where lower(coalesce(sa.position_name, '')) like '%начальник смены%'
  ) as scope_map on true
  where sa.session_id = p_briefing_id
    and sa.is_present = true
  on conflict (session_id, employee_id, scope, workplace_code)
  do update set revoked_at = null;

  return p_briefing_id;
end;
$$;

-- 7) RPC: start round for today
create or replace function public.start_round_for_today(
  p_unit text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_employee_id int;
  v_today date := current_date;
  v_unit text;
  v_schedule_id bigint;
  v_plan_id bigint;
  v_run_id bigint;
  v_session_id uuid;
begin
  if v_profile_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select employee_id into v_employee_id
  from public.profiles
  where id = v_profile_id;

  if v_employee_id is null then
    raise exception 'PROFILE_NOT_LINKED';
  end if;

  select s.id, s.unit
  into v_schedule_id, v_unit
  from public.schedule s
  where s.employee_id = v_employee_id
    and s.date = v_today
    and (p_unit is null or s.unit = p_unit)
  order by s.id asc
  limit 1;

  v_unit := coalesce(v_unit, p_unit, '');

  select rr.id
  into v_run_id
  from public.round_runs rr
  where rr.created_by_profile_id = v_profile_id
    and rr.run_date = v_today
    and coalesce(rr.unit, '') = coalesce(v_unit, '')
    and rr.status in ('draft', 'submitted')
  order by rr.created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  select ss.id
  into v_session_id
  from public.shift_sessions ss
  join public.shift_assignments sa on sa.session_id = ss.id and sa.employee_id = v_employee_id and sa.is_present = true
  where ss.shift_date = v_today
    and coalesce(ss.unit, '') = coalesce(v_unit, '')
    and ss.status in ('confirmed', 'active')
  order by ss.created_at desc
  limit 1;

  select rp.id
  into v_plan_id
  from public.round_plans rp
  where rp.plan_date = v_today
    and (rp.unit = v_unit or rp.unit is null)
  order by (case when rp.unit = v_unit then 0 else 1 end), rp.id desc
  limit 1;

  insert into public.round_runs (
    created_by_profile_id,
    created_by_employee_id,
    run_date,
    unit,
    schedule_id,
    shift_session_id,
    status
  )
  values (
    v_profile_id,
    v_employee_id,
    v_today,
    v_unit,
    v_schedule_id,
    v_session_id,
    'draft'
  )
  returning id into v_run_id;

  if v_plan_id is not null then
    insert into public.round_run_checks (run_id, item_id, status)
    select v_run_id, rpi.item_id, 'na'
    from public.round_plan_items rpi
    where rpi.plan_id = v_plan_id
    order by rpi.sort_order asc
    on conflict (run_id, item_id) do nothing;
  end if;

  return v_run_id;
end;
$$;

-- 8) RPC: my shift today
create or replace function public.get_my_shift_today(
  p_unit text default null
)
returns table (
  session_id uuid,
  unit text,
  shift_date date,
  shift_type text,
  session_status text,
  workplace_code text,
  position_name text,
  is_present boolean,
  instructed boolean,
  leader_employee_id int,
  leader_profile_id uuid
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ss.id as session_id,
    ss.unit,
    ss.shift_date,
    ss.shift_type,
    ss.status as session_status,
    sa.workplace_code,
    sa.position_name,
    sa.is_present,
    (ss.status in ('confirmed', 'active', 'closed')) as instructed,
    ss.leader_employee_id,
    ss.leader_profile_id
  from public.profiles pr
  join public.shift_assignments sa on sa.employee_id = pr.employee_id
  join public.shift_sessions ss on ss.id = sa.session_id
  where pr.id = auth.uid()
    and ss.shift_date = current_date
    and (p_unit is null or ss.unit = p_unit)
  order by ss.created_at desc
  limit 1;
$$;

-- 9) RLS
alter table public.shift_sessions enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.shift_permissions enable row level security;
alter table public.inspection_items enable row level security;
alter table public.round_plans enable row level security;
alter table public.round_plan_items enable row level security;
alter table public.round_runs enable row level security;
alter table public.round_run_checks enable row level security;
alter table public.round_run_files enable row level security;

-- shift_sessions
DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_sessions' and policyname='shift_sessions_select_leader_or_member') then
    create policy shift_sessions_select_leader_or_member on public.shift_sessions
      for select using (
        leader_profile_id = auth.uid()
        or exists (
          select 1
          from public.profiles pr
          join public.shift_assignments sa on sa.employee_id = pr.employee_id
          where pr.id = auth.uid()
            and sa.session_id = shift_sessions.id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_sessions' and policyname='shift_sessions_insert_leader') then
    create policy shift_sessions_insert_leader on public.shift_sessions
      for insert with check (leader_profile_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_sessions' and policyname='shift_sessions_update_leader') then
    create policy shift_sessions_update_leader on public.shift_sessions
      for update using (leader_profile_id = auth.uid())
      with check (leader_profile_id = auth.uid());
  end if;
end $$;

-- shift_assignments
DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_assignments' and policyname='shift_assignments_select_leader_or_self') then
    create policy shift_assignments_select_leader_or_self on public.shift_assignments
      for select using (
        exists (
          select 1 from public.shift_sessions ss
          where ss.id = shift_assignments.session_id
            and ss.leader_profile_id = auth.uid()
        )
        or employee_id = (
          select pr.employee_id from public.profiles pr where pr.id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_assignments' and policyname='shift_assignments_modify_leader_before_confirm') then
    create policy shift_assignments_modify_leader_before_confirm on public.shift_assignments
      for all using (
        exists (
          select 1 from public.shift_sessions ss
          where ss.id = shift_assignments.session_id
            and ss.leader_profile_id = auth.uid()
            and ss.status = 'draft'
        )
      )
      with check (
        exists (
          select 1 from public.shift_sessions ss
          where ss.id = shift_assignments.session_id
            and ss.leader_profile_id = auth.uid()
            and ss.status = 'draft'
        )
      );
  end if;
end $$;

-- shift_permissions
DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shift_permissions' and policyname='shift_permissions_select_self_or_leader') then
    create policy shift_permissions_select_self_or_leader on public.shift_permissions
      for select using (
        employee_id = (select pr.employee_id from public.profiles pr where pr.id = auth.uid())
        or exists (
          select 1 from public.shift_sessions ss
          where ss.id = shift_permissions.session_id
            and ss.leader_profile_id = auth.uid()
        )
      );
  end if;
end $$;

-- Dictionaries/plans: authenticated read
DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='inspection_items' and policyname='inspection_items_select_auth') then
    create policy inspection_items_select_auth on public.inspection_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_plans' and policyname='round_plans_select_auth') then
    create policy round_plans_select_auth on public.round_plans for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_plan_items' and policyname='round_plan_items_select_auth') then
    create policy round_plan_items_select_auth on public.round_plan_items for select to authenticated using (true);
  end if;
end $$;

-- round_runs/checks/files: own data only
DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_runs' and policyname='round_runs_select_own') then
    create policy round_runs_select_own on public.round_runs for select using (created_by_profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_runs' and policyname='round_runs_insert_own') then
    create policy round_runs_insert_own on public.round_runs for insert with check (created_by_profile_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_runs' and policyname='round_runs_update_own') then
    create policy round_runs_update_own on public.round_runs for update
      using (created_by_profile_id = auth.uid())
      with check (created_by_profile_id = auth.uid());
  end if;
end $$;

DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_run_checks' and policyname='round_run_checks_select_own') then
    create policy round_run_checks_select_own on public.round_run_checks for select using (
      exists (
        select 1 from public.round_runs rr
        where rr.id = round_run_checks.run_id
          and rr.created_by_profile_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_run_checks' and policyname='round_run_checks_insert_own') then
    create policy round_run_checks_insert_own on public.round_run_checks for insert with check (
      exists (
        select 1 from public.round_runs rr
        where rr.id = round_run_checks.run_id
          and rr.created_by_profile_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_run_checks' and policyname='round_run_checks_update_own') then
    create policy round_run_checks_update_own on public.round_run_checks for update
      using (
        exists (
          select 1 from public.round_runs rr
          where rr.id = round_run_checks.run_id
            and rr.created_by_profile_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.round_runs rr
          where rr.id = round_run_checks.run_id
            and rr.created_by_profile_id = auth.uid()
        )
      );
  end if;
end $$;

DO $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_run_files' and policyname='round_run_files_select_own') then
    create policy round_run_files_select_own on public.round_run_files for select using (
      exists (
        select 1
        from public.round_run_checks rc
        join public.round_runs rr on rr.id = rc.run_id
        where rc.id = round_run_files.check_id
          and rr.created_by_profile_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='round_run_files' and policyname='round_run_files_insert_own') then
    create policy round_run_files_insert_own on public.round_run_files for insert with check (
      created_by_profile_id = auth.uid()
      and exists (
        select 1
        from public.round_run_checks rc
        join public.round_runs rr on rr.id = rc.run_id
        where rc.id = round_run_files.check_id
          and rr.created_by_profile_id = auth.uid()
      )
    );
  end if;
end $$;

-- 10) Grants for RPC
grant execute on function public.create_or_get_shift_briefing(date, text, text) to authenticated;
grant execute on function public.confirm_shift_briefing(uuid) to authenticated;
grant execute on function public.start_round_for_today(text) to authenticated;
grant execute on function public.get_my_shift_today(text) to authenticated;

-- 11) Storage bucket + policies for round files
insert into storage.buckets (id, name, public)
values ('round-files', 'round-files', false)
on conflict (id) do nothing;

DO $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='round_files_select_own'
  ) then
    create policy round_files_select_own on storage.objects
      for select to authenticated
      using (
        bucket_id = 'round-files'
        and exists (
          select 1 from public.round_runs rr
          where rr.id::text = split_part(name, '/', 1)
            and rr.created_by_profile_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='round_files_insert_own'
  ) then
    create policy round_files_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'round-files'
        and exists (
          select 1 from public.round_runs rr
          where rr.id::text = split_part(name, '/', 1)
            and rr.created_by_profile_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='round_files_update_delete_own'
  ) then
    create policy round_files_update_delete_own on storage.objects
      for all to authenticated
      using (
        bucket_id = 'round-files'
        and exists (
          select 1 from public.round_runs rr
          where rr.id::text = split_part(name, '/', 1)
            and rr.created_by_profile_id = auth.uid()
        )
      )
      with check (
        bucket_id = 'round-files'
        and exists (
          select 1 from public.round_runs rr
          where rr.id::text = split_part(name, '/', 1)
            and rr.created_by_profile_id = auth.uid()
        )
      );
  end if;
end $$;
