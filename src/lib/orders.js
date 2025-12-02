// Помощники для журнала распоряжений КТЦ (устаревающий вариант до перехода на entries/journals)
import { supabase } from './supabaseClient'

const BASE_SELECT = 'id, type, title, body, author_name, control_point, created_at'

export async function fetchOrders({ type } = {}) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  let query = supabase.from('orders').select(BASE_SELECT).order('created_at', { ascending: false })
  if (type) query = query.eq('type', type)
  return query
}

export async function createOrder({ type, title, body, authorName, control_point }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('orders')
    .insert({ type, title, body, author_name: authorName, control_point })
    .select(BASE_SELECT)
    .maybeSingle()
}
