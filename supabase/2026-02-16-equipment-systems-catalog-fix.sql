-- Ensure equipment_systems is a usable dictionary for UI selector.
-- Run in Supabase SQL Editor.

begin;

-- 1) Normalize/seed system names from existing equipment rows.
insert into public.equipment_systems (name)
select distinct trim(e.equipment_system) as name
from public.equipment e
where nullif(trim(e.equipment_system), '') is not null
  and not exists (
    select 1
    from public.equipment_systems s
    where upper(trim(s.name)) = upper(trim(e.equipment_system))
  );

-- 2) Keep one canonical row per normalized name (optional cleanup).
with ranked as (
  select
    id,
    upper(trim(name)) as norm_name,
    row_number() over (partition by upper(trim(name)) order by id) as rn
  from public.equipment_systems
),
dups as (
  select id, norm_name
  from ranked
  where rn > 1
),
canon as (
  select norm_name, min(id) as keep_id
  from ranked
  group by norm_name
)
update public.equipment e
set system_id = c.keep_id
from dups d
join canon c on c.norm_name = d.norm_name
where e.system_id = d.id;

delete from public.equipment_systems s
using dups d
where s.id = d.id;

-- 3) Enforce uniqueness for stable selector.
create unique index if not exists equipment_systems_name_norm_uq
  on public.equipment_systems (upper(trim(name)));

-- 4) Read policy (needed if RLS is enabled).
alter table public.equipment_systems enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipment_systems'
      and policyname = 'equipment_systems_select_all'
  ) then
    create policy equipment_systems_select_all
      on public.equipment_systems
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

commit;
