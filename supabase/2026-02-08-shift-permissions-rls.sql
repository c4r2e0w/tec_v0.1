-- RLS: проверка прав записи в entries по активной смене.
-- Предполагается, что применена миграция 2026-02-08-shift-handover-mvp.sql

create or replace function public.has_active_shift_permission(
  p_profile_id uuid,
  p_unit text,
  p_scope text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.shift_permissions sp on sp.employee_id = pr.employee_id
    join public.shift_sessions ss on ss.id = sp.session_id
    where pr.id = p_profile_id
      and ss.unit = p_unit
      and ss.status = 'active'
      and sp.scope = p_scope
      and sp.revoked_at is null
      and ss.shift_date = current_date
  );
$$;

alter table public.entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entries'
      and policyname = 'entries_insert_by_shift_scope'
  ) then
    create policy entries_insert_by_shift_scope
      on public.entries
      for insert
      with check (
        created_by_profile_id = auth.uid()
        and (
          -- Суточная ведомость
          (type = 'daily' and public.has_active_shift_permission(auth.uid(), coalesce(unit, ''), 'daily_statement'))
          -- Оперативный журнал
          or (type in ('turbine', 'boiler') and public.has_active_shift_permission(auth.uid(), coalesce(unit, ''), 'operational_log'))
          -- Админские записи только для начальника смены
          or (type = 'admin' and public.has_active_shift_permission(auth.uid(), coalesce(unit, ''), 'shift_control'))
        )
      );
  end if;
end $$;

