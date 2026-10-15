-- MyTEC schema/data audit. READ ONLY. Run in Supabase SQL Editor.
-- The dashboard list_tables.rows field reported 0 while SELECT COUNT(*) confirmed rows.
-- This query is the source of truth for counts.
select 'departments' as entity, count(*) as row_count from public.departments
union all select 'workplaces', count(*) from public.workplaces
union all select 'equipment_types', count(*) from public.equipment_types
union all select 'equipment', count(*) from public.equipment
union all select 'technology_systems', count(*) from public.technology_systems
union all select 'equipment_systems', count(*) from public.equipment_systems
union all select 'pipelines', count(*) from public.pipelines
union all select 'pipeline_connection_points', count(*) from public.pipeline_connection_points
union all select 'valves', count(*) from public.valves
union all select 'kb_folders', count(*) from public.kb_folders
union all select 'kb_registry_items', count(*) from public.kb_registry_items
union all select 'kb_documents', count(*) from public.kb_documents
union all select 'kb_chunks', count(*) from public.kb_chunks
order by entity;

-- Equipment <-> system membership is a junction table, not equipment.system_id.
select e.code as equipment_code, e.name as equipment_name,
       e.station_number, e.status::text as status,
       ts.code as system_code, ts.name as system_name,
       es.role, es.is_primary
from public.equipment e
left join public.equipment_systems es on es.equipment_id = e.id
left join public.technology_systems ts on ts.id = es.system_id
order by e.code, es.is_primary desc nulls last, ts.code;

-- Pipe connection coverage, without inventing topology.
select p.code as pipeline_code, p.name as pipeline_name,
       count(pcp.id) as connection_points
from public.pipelines p
left join public.pipeline_connection_points pcp on pcp.pipeline_id = p.id
group by p.id, p.code, p.name
order by p.code;

-- Data quality: disconnected references in membership table.
select es.equipment_id, es.system_id
from public.equipment_systems es
left join public.equipment e on e.id = es.equipment_id
left join public.technology_systems ts on ts.id = es.system_id
where e.id is null or ts.id is null;
