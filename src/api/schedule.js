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
      employees:employee_id ( first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type ) ),
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

export async function createOverride({ supabase, payload }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase.from('schedule_overrides').insert(payload).select().maybeSingle()
}

export async function fetchShiftTemplates({ supabase }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  return supabase.from('shift_templates').select('id, code, name, start_time, end_time, duration_hours, night, is_rotational').order('name', { ascending: true })
}

export async function fetchEmployeesByUnit({ supabase, unit }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  // Тянем всех, фильтруем по unit на клиенте (надёжнее при вложенных полях)
  return supabase
    .from('employees')
    .select('id, first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type )')
    .order('last_name', { ascending: true })
    .limit(500)
}
