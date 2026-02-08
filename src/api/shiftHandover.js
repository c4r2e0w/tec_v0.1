export async function fetchBriefingTopicForDate({ supabase, unit, shiftDate }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const month = shiftDate.slice(0, 8) + '01'

  const byDay = await supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
    .eq('unit', unit)
    .eq('briefing_date', shiftDate)
    .maybeSingle()
  if (!byDay.error && byDay.data) return byDay

  return supabase
    .from('briefing_topics')
    .select('id, unit, month, briefing_date, topic, materials, is_mandatory')
    .eq('unit', unit)
    .eq('month', month)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export async function fetchShiftSession({ supabase, unit, shiftDate, shiftType = 'day' }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_sessions')
    .select('id, unit, shift_date, shift_type, status, chief_employee_id, briefing_topic_id, confirmed_at, confirmed_by, created_at')
    .eq('unit', unit)
    .eq('shift_date', shiftDate)
    .eq('shift_type', shiftType)
    .maybeSingle()
}

export async function createShiftSession({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_sessions')
    .upsert(payload, { onConflict: 'unit,shift_date,shift_type' })
    .select('id, unit, shift_date, shift_type, status, chief_employee_id, briefing_topic_id, confirmed_at, confirmed_by, created_at')
    .maybeSingle()
}

export async function updateShiftSession({ supabase, sessionId, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_sessions')
    .update(payload)
    .eq('id', sessionId)
    .select('id, unit, shift_date, shift_type, status, chief_employee_id, briefing_topic_id, confirmed_at, confirmed_by, created_at')
    .maybeSingle()
}

export async function fetchShiftAssignments({ supabase, sessionId }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('shift_assignments')
    .select('id, session_id, employee_id, workplace_code, position_name, source, is_present, note, confirmed_by_chief, confirmed_at')
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
