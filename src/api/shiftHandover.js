export async function fetchBriefingTopicForDate({ supabase, unit, shiftDate }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const day = Number(String(shiftDate || '').slice(8, 10)) || 1
  const templateDate = `2000-01-${String(Math.min(Math.max(day, 1), 31)).padStart(2, '0')}`
  const month = shiftDate.slice(0, 8) + '01'

  const byDay = await supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
    .eq('unit', unit)
    .eq('briefing_date', shiftDate)
    .maybeSingle()
  if (!byDay.error && byDay.data) return byDay

  const byTemplate = await supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
    .eq('unit', unit)
    .eq('briefing_date', templateDate)
    .maybeSingle()
  if (!byTemplate.error && byTemplate.data) return byTemplate

  return supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
    .eq('unit', unit)
    .eq('month', month)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export async function fetchBriefingTopicsRange({ supabase, unit, from, to }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
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
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
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
    .select('id, session_id, employee_id, workplace_code, position_name, source, is_present, note, confirmed_by_chief, confirmed_at, employees:employee_id(id, first_name, last_name, middle_name, positions:position_id(name))')
    .eq('session_id', sessionId)
    .order('employee_id', { ascending: true })
}

export async function upsertShiftAssignments({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_assignments')
    .upsert(payload, { onConflict: 'session_id,employee_id' })
    .select('id, session_id, employee_id, workplace_code, position_name, source, is_present, note, confirmed_by_chief, confirmed_at')
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
