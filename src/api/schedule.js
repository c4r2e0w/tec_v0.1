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
  const { positionIds, query } = filters
  let empQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, middle_name, position_id, positions:position_id ( name, departament_name, devision_name, type, sort_weight )')
    .order('sort_weight', { ascending: true, foreignTable: 'positions', nullsFirst: false })
    .order('last_name', { ascending: true })

  if (Array.isArray(positionIds) && positionIds.length) empQuery = empQuery.in('position_id', positionIds)
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
  if (unit) query = query.or(`unit.eq.${unit},unit.is.null`)
  return query
}

export async function uploadScheduleImportSource({ supabase, unit, file, userId }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  if (!file) return { data: null, error: new Error('Файл не выбран') }
  const safeUnit = String(unit || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
  const safeName = String(file.name || 'import')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const uid = String(userId || 'anon').replace(/[^a-z0-9_-]/gi, '_')
  const path = `${safeUnit}/${stamp}-${uid}-${safeName}`
  const upload = await supabase.storage.from('schedule-imports').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (upload.error) {
    const rawMessage = String(upload.error?.message || '')
    if (rawMessage.toLowerCase().includes('bucket not found')) {
      return {
        data: null,
        error: new Error('Bucket `schedule-imports` не найден. Создайте его в Supabase Storage или продолжайте без сохранения файла в Storage.'),
      }
    }
    return { data: null, error: upload.error }
  }
  return { data: { path, bucket: 'schedule-imports', size: file.size, mime: file.type || '' }, error: null }
}
