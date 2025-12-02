// API helpers for employees table

export async function fetchEmployeeById(supabase, id) {
  return supabase
    .from('employees')
    .select(
      `
      id,
      first_name,
      last_name,
      middle_name,
      position_id,
      birth_date,
      phone,
      positions:position_id ( name, departament_name, devision_name )
    `,
    )
    .eq('id', id)
    .maybeSingle()
}

export async function searchEmployees(supabase, term, limit = 100) {
  let query = supabase.from('employees').select('id, first_name, last_name, middle_name').order('last_name', { ascending: true }).limit(limit)
  if (term) query = query.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%`)
  return query
}

export async function updateEmployee(supabase, id, payload) {
  return supabase.from('employees').update(payload).eq('id', id)
}
