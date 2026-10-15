# MyTEC RLS access findings — 2026-10-15

Read-only database checks confirm that RLS is enabled on:
- public.equipment
- public.equipment_types
- public.equipment_systems
- public.technology_systems
- public.workplaces

The pg_policies view returned **zero policies** for these five tables.

## Impact

Supabase's normal anon/authenticated client roles cannot read these tables under RLS unless access is provided by a suitable policy or another specifically verified mechanism. The equipment page may show zero records despite equipment containing 13 records. Do **not** disable RLS or grant public write access to fix this.

## Required design decision

1. Establish who may view equipment (public visitors vs authenticated station personnel).
2. Establish who may edit equipment and memberships (a restricted editor role).
3. Confirm authentication and role claims in the app.
4. Add minimal SELECT policies and separately scoped INSERT/UPDATE policies, only after confirming intended identities.
5. Test as the actual frontend client role; a SQL Editor count uses elevated permissions and does not prove frontend access.

No RLS policies have been applied. No production database rows were changed.
