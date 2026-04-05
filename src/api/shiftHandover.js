const BRIEFING_TOPIC_FIELDS = 'id, unit, month, briefing_date, topic, round_topic, materials, is_mandatory'

const dayOfMonth = (value) => Number(String(value || '').slice(8, 10)) || 0

const pickLatestRow = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return null
  return [...rows].sort((left, right) => {
    const byDate = String(right?.briefing_date || '').localeCompare(String(left?.briefing_date || ''))
    if (byDate !== 0) return byDate
    return String(right?.created_at || '').localeCompare(String(left?.created_at || ''))
  })[0]
}

const pickByDayOfMonth = (rows, day) => pickLatestRow((rows || []).filter((row) => dayOfMonth(row?.briefing_date) === day))

const emptyTopicResult = { data: null, error: null }

export async function fetchBriefingTopicForDate({ supabase, unit, shiftDate }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  if (!shiftDate) return emptyTopicResult

  const day = Number(String(shiftDate || '').slice(8, 10)) || 1
  const templateDate = `2000-01-${String(Math.min(Math.max(day, 1), 31)).padStart(2, '0')}`

  const byTemplate = await supabase
    .from('briefing_topics')
    .select(BRIEFING_TOPIC_FIELDS)
    .eq('unit', unit)
    .eq('briefing_date', templateDate)
    .limit(1)
  if (byTemplate.error) return { data: null, error: byTemplate.error }
  if (byTemplate.data?.length) return { data: byTemplate.data[0], error: null }

  const byAnyMonth = await supabase
    .from('briefing_topics')
    .select(BRIEFING_TOPIC_FIELDS)
    .eq('unit', unit)
    .not('briefing_date', 'is', null)
    .order('briefing_date', { ascending: false })
    .limit(400)
  if (byAnyMonth.error) return { data: null, error: byAnyMonth.error }
  const anyMonthMatch = pickByDayOfMonth(byAnyMonth.data, day)
  return { data: anyMonthMatch, error: null }
}

export async function fetchBriefingTopicsRange({ supabase, unit, from, to }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, round_topic, materials, is_mandatory')
    .order('briefing_date', { ascending: true })
  if (unit) query = query.eq('unit', unit)
  if (from) query = query.gte('briefing_date', from)
  if (to) query = query.lte('briefing_date', to)
  return query
}

export async function upsertBriefingTopics({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('briefing_topics')
    .upsert(payload, { onConflict: 'unit,briefing_date' })
    .select('id, unit, month, briefing_date, topic, round_topic, materials, is_mandatory')
}

export async function fetchShiftSession({ supabase, unit, shiftDate, shiftType = 'day' }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_sessions')
    .select('*')
    .eq('unit', unit)
    .eq('shift_date', shiftDate)
    .eq('shift_type', shiftType)
    .maybeSingle()
}

export async function createShiftSession({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const res = await supabase
    .from('shift_sessions')
    .upsert(payload, { onConflict: 'unit,shift_date,shift_type' })
    .select('*')
    .maybeSingle()
  if (!res.error) return res

  const msg = String(res.error.message || '').toLowerCase()
  if (msg.includes('briefing_topic_id') && payload?.briefing_topic_id !== undefined) {
    const fallbackPayload = { ...payload }
    fallbackPayload.brifing_topic_id = fallbackPayload.briefing_topic_id
    delete fallbackPayload.briefing_topic_id
    return supabase
      .from('shift_sessions')
      .upsert(fallbackPayload, { onConflict: 'unit,shift_date,shift_type' })
      .select('*')
      .maybeSingle()
  }
  return res
}

export async function updateShiftSession({ supabase, sessionId, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const res = await supabase
    .from('shift_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select('*')
    .maybeSingle()
  if (!res.error) return res

  const msg = String(res.error.message || '').toLowerCase()
  if (msg.includes('briefing_topic_id') && payload?.briefing_topic_id !== undefined) {
    const fallbackPayload = { ...payload }
    fallbackPayload.brifing_topic_id = fallbackPayload.briefing_topic_id
    delete fallbackPayload.briefing_topic_id
    return supabase
      .from('shift_sessions')
      .update(fallbackPayload)
      .eq('id', sessionId)
      .select('*')
      .maybeSingle()
  }
  return res
}

export async function fetchShiftAssignments({ supabase, sessionId }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_assignments')
    .select('id, session_id, employee_id, workplace_code, position_name, source, is_present, note, attendance_status, actual_start_time, actual_end_time, actual_hours, fact_note, confirmed_by_chief, confirmed_at, employees:employee_id(id, first_name, last_name, middle_name, position_id, positions:position_id(name, sort_weight, type))')
    .eq('session_id', sessionId)
    .order('employee_id', { ascending: true })
}

export async function upsertShiftAssignments({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_assignments')
    .upsert(payload, { onConflict: 'session_id,employee_id' })
    .select('id, session_id, employee_id, workplace_code, position_name, source, is_present, note, attendance_status, actual_start_time, actual_end_time, actual_hours, fact_note, confirmed_by_chief, confirmed_at')
}

export async function upsertShiftPermissions({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_permissions')
    .upsert(payload, { onConflict: 'session_id,employee_id,scope,workplace_code' })
    .select('id, session_id, employee_id, scope, workplace_code, granted_at, revoked_at')
}

export async function fetchActiveShiftPermissions({ supabase, sessionId, employeeId }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_permissions')
    .select('id, session_id, employee_id, scope, workplace_code, granted_at, revoked_at')
    .eq('session_id', sessionId)
    .eq('employee_id', employeeId)
    .is('revoked_at', null)
}
