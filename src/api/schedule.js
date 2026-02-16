// API helpers for schedule and overrides

export async function fetchScheduleRange({ supabase, from, to, unit }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase
    .from('schedule')
    .select(
      `
      id,
      employee_id,
      date,
      start_time,
      end_time,
      planned_hours,
      unit,
      source,
      note,
      template_id,
      employees:employee_id ( first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type, sort_weight ) ),
      shift_templates:template_id ( code, name )
    `,
    )
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('employee_id', { ascending: true })

  if (unit) query = query.eq('unit', unit)
  return query
}

export async function fetchOverridesRange({ supabase, from, to, unit }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase
    .from('schedule_overrides')
    .select(
      `
      id,
      employee_id,
      date,
      kind,
      hours_delta,
      start_time,
      end_time,
      comment,
      unit,
      employees:employee_id ( first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type ) )
    `,
    )
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('employee_id', { ascending: true })

  if (unit) query = query.eq('unit', unit)
  return query
}

export async function createScheduleEntry({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('schedule').upsert(payload, { onConflict: 'employee_id,date' }).select().maybeSingle()
}

export async function deleteScheduleEntry({ supabase, employeeId, date }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('schedule').delete().eq('employee_id', employeeId).eq('date', date)
}

export async function createOverride({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('schedule_overrides').insert(payload).select().maybeSingle()
}

export async function fetchShiftTemplates({ supabase }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase.from('shift_templates').select('id, code, name, start_time, end_time, duration_hours, night, is_rotational').order('name', { ascending: true })
}

export async function fetchEmployeesByUnit({ supabase, filters = {} }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  const { positionIds, query, unit } = filters
  let empQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type, sort_weight )')
    .order('sort_weight', { ascending: true, foreignTable: 'positions', nullsFirst: false })
    .order('last_name', { ascending: true })

  if (Array.isArray(positionIds) && positionIds.length) empQuery = empQuery.in('position_id', positionIds)
  if (unit) empQuery = empQuery.eq('unit', unit)
  if (query) {
    const pattern = `%${query}%`
    empQuery = empQuery.or(`last_name.ilike.${pattern},first_name.ilike.${pattern},middle_name.ilike.${pattern}`)
  }

  return empQuery.limit(500)
}

export async function fetchPositions({ supabase }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase.from('positions').select('id, name, departament_name, devision_name, type, sort_weight').order('sort_weight', { ascending: true, nullsFirst: false }).order('name', { ascending: true })
}

export async function fetchWorkplaces({ supabase, unit }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase.from('workplace').select('*').order('id', { ascending: true })
  if (unit) query = query.eq('unit', unit)
  return query
}
