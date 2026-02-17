-- Расширение таблицы shift_assignments для фиксации ФАКТА отработки смены.
-- План (schedule) остается планом; факт для оплаты хранится здесь.

begin;

alter table if exists public.shift_assignments
  add column if not exists attendance_status text,
  add column if not exists actual_start_time time,
  add column if not exists actual_end_time time,
  add column if not exists actual_hours numeric(6,2),
  add column if not exists fact_note text;

-- Первичное заполнение статуса присутствия для исторических данных.
update public.shift_assignments
set attendance_status = case when is_present then 'full' else 'absent' end
where attendance_status is null;

alter table if exists public.shift_assignments
  alter column attendance_status set default 'full',
  alter column attendance_status set not null;

-- Валидные статусы факта смены.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_assignments_attendance_status_chk'
      and conrelid = 'public.shift_assignments'::regclass
  ) then
    alter table public.shift_assignments
      add constraint shift_assignments_attendance_status_chk
      check (attendance_status in ('full', 'late', 'left_early', 'partial', 'replaced', 'absent'));
  end if;
end $$;

-- Фактически отработанные часы не могут быть отрицательными.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_assignments_actual_hours_nonnegative_chk'
      and conrelid = 'public.shift_assignments'::regclass
  ) then
    alter table public.shift_assignments
      add constraint shift_assignments_actual_hours_nonnegative_chk
      check (actual_hours is null or actual_hours >= 0);
  end if;
end $$;

comment on column public.shift_assignments.attendance_status is 'Статус фактической отработки: full/late/left_early/partial/replaced/absent';
comment on column public.shift_assignments.actual_start_time is 'Фактическое время начала работы в смене';
comment on column public.shift_assignments.actual_end_time is 'Фактическое время окончания работы в смене';
comment on column public.shift_assignments.actual_hours is 'Фактически отработанные часы за смену (используется для табеля/оплаты)';
comment on column public.shift_assignments.fact_note is 'Причина отклонения от плана (опоздание, ранний уход, семейные обстоятельства и т.д.)';

create index if not exists idx_shift_assignments_session_status
  on public.shift_assignments(session_id, attendance_status);

commit;
