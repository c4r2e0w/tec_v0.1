// API helpers for profiles table
export async function fetchProfileByUserId(supabase, userId) {
  return supabase.from('profiles').select('employee_id').eq('id', userId).maybeSingle()
}

export async function upsertProfileLink(supabase, userId, employeeId) {
  return supabase
    .from('profiles')
    .upsert({
      id: userId,
      employee_id: employeeId ? Number(employeeId) : null,
      updated_at: new Date().toISOString(),
    })
}
