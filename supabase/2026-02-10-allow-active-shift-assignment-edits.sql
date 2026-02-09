-- Allow shift leader to adjust assignments in active sessions (for replacements).

create or replace function public.is_shift_session_editable_for_leader(p_session_id uuid)
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
      and ss.status in ('draft', 'active')
  );
$$;

grant execute on function public.is_shift_session_editable_for_leader(uuid) to authenticated;

drop policy if exists shift_assignments_modify_leader_before_confirm on public.shift_assignments;
create policy shift_assignments_modify_leader_before_confirm on public.shift_assignments
  for all using (
    public.is_shift_session_editable_for_leader(session_id)
  )
  with check (
    public.is_shift_session_editable_for_leader(session_id)
  );
