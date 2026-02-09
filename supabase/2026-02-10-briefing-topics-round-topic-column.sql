-- Normalize round topic storage: keep it in dedicated column.

alter table if exists public.briefing_topics
  add column if not exists round_topic text;

-- Backfill from JSON materials: {"round_topic":"..."}
update public.briefing_topics
set round_topic = coalesce(round_topic, materials::jsonb ->> 'round_topic')
where round_topic is null
  and materials is not null
  and left(btrim(materials), 1) = '{';

-- Backfill from plain text seed: "Тема обхода: ..."
update public.briefing_topics
set round_topic = coalesce(round_topic, nullif(btrim(regexp_replace(materials, '^\\s*Тема обхода:\\s*', '', 'i')), ''))
where round_topic is null
  and materials is not null
  and materials ~* '^\\s*Тема обхода:';
