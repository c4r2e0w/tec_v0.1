export async function rpcCreateOrGetShiftBriefing({ supabase, date, unit, shiftType = 'day' }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.rpc('create_or_get_shift_briefing', {
    p_date: date,
    p_unit: unit,
    p_shift_type: shiftType,
  })
}

export async function rpcConfirmShiftBriefing({ supabase, briefingId }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.rpc('confirm_shift_briefing', { p_briefing_id: briefingId })
}

export async function rpcGetMyShiftToday({ supabase, unit = null }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.rpc('get_my_shift_today', { p_unit: unit })
}

export async function rpcStartRoundForToday({ supabase, unit = null }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.rpc('start_round_for_today', { p_unit: unit })
}

export async function fetchWorkplacesDictionary({ supabase, unit = null }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let q = supabase.from('workplace').select('*').eq('is_active', true).order('name', { ascending: true })
  if (unit) q = q.eq('unit', unit)
  return q
}

export async function fetchRoundRun({ supabase, runId }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('round_runs')
    .select('id, run_date, unit, status, comment, created_at, submitted_at, created_by_profile_id')
    .eq('id', runId)
    .maybeSingle()
}

export async function fetchRoundRunChecks({ supabase, runId }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('round_run_checks')
    .select('id, run_id, item_id, status, comment, measured_value, inspection_items:item_id(id, code, name, description, category)')
    .eq('run_id', runId)
    .order('id', { ascending: true })
}

export async function fetchRoundRunFiles({ supabase, checkIds = [] }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  if (!checkIds.length) return { data: [], error: null }
  return supabase
    .from('round_run_files')
    .select('id, check_id, storage_path, file_name, created_at')
    .in('check_id', checkIds)
    .order('created_at', { ascending: false })
}

export async function updateRoundRun({ supabase, runId, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('round_runs').update(payload).eq('id', runId).select('*').maybeSingle()
}

export async function updateRoundCheck({ supabase, checkId, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('round_run_checks').update(payload).eq('id', checkId).select('*').maybeSingle()
}

export async function insertRoundRunFile({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('round_run_files').insert(payload).select('*').maybeSingle()
}

export async function fetchMyRoundRuns({ supabase, from, to, status = '' }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let q = supabase
    .from('round_runs')
    .select('id, run_date, unit, status, comment, created_at, submitted_at, round_run_checks(id, status)')
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (from) q = q.gte('run_date', from)
  if (to) q = q.lte('run_date', to)
  if (status) q = q.eq('status', status)
  return q
}

export async function fetchRoundPlanForDate({ supabase, date, unit = null }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  let q = supabase
    .from('round_plans')
    .select('id, plan_date, unit, round_plan_items(id, sort_order, inspection_items:item_id(id, code, name, description))')
    .eq('plan_date', date)
    .order('sort_order', { ascending: true, foreignTable: 'round_plan_items' })
  if (unit) q = q.eq('unit', unit)
  const res = await q
  if (res.error || !Array.isArray(res.data) || !res.data.length) return res
  const exact = unit ? res.data.find((p) => p.unit === unit) : res.data[0]
  return { data: exact, error: null }
}
