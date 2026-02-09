-- Fix RLS recursion between shift_sessions and shift_assignments.
-- Error seen: "infinite recursion detected in policy for relation shift_assignments"

-- 1) Helper functions for policy checks (run as owner, avoid policy self-recursion)
create or replace function public.current_employee_id()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select pr.employee_id
  from public.profiles pr
  where pr.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_shift_session_leader(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shift_sessions ss
    where ss.id = p_session_id
      and ss.leader_profile_id = auth.uid()
  );
$$;

create or replace function public.is_shift_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shift_assignments sa
    join public.profiles pr on pr.employee_id = sa.employee_id
    where sa.session_id = p_session_id
      and pr.id = auth.uid()
  );
$$;

create or replace function public.is_shift_session_draft_for_leader(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shift_sessions ss
    where ss.id = p_session_id
      and ss.leader_profile_id = auth.uid()
      and ss.status = 'draft'
  );
$$;

-- Keep EXECUTE only for authenticated users.
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_shift_session_leader(uuid) to authenticated;
grant execute on function public.is_shift_session_member(uuid) to authenticated;
grant execute on function public.is_shift_session_draft_for_leader(uuid) to authenticated;

-- 2) Recreate recursive policies in non-recursive form

drop policy if exists shift_sessions_select_leader_or_member on public.shift_sessions;
create policy shift_sessions_select_leader_or_member on public.shift_sessions
  for select using (
    leader_profile_id = auth.uid()
    or public.is_shift_session_member(id)
  );

drop policy if exists shift_assignments_select_leader_or_self on public.shift_assignments;
create policy shift_assignments_select_leader_or_self on public.shift_assignments
  for select using (
    public.is_shift_session_leader(session_id)
    or employee_id = public.current_employee_id()
  );

drop policy if exists shift_assignments_modify_leader_before_confirm on public.shift_assignments;
create policy shift_assignments_modify_leader_before_confirm on public.shift_assignments
  for all using (
    public.is_shift_session_draft_for_leader(session_id)
  )
  with check (
    public.is_shift_session_draft_for_leader(session_id)
  );
