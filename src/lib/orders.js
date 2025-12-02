import { supabase } from './supabaseClient'

const UNIT = 'ktc'
const SECTION = 'docs'

export async function fetchOrders({ type }) {
  const query = supabase
    .from('orders')
    .select('id, title, body, type, author_name, created_at, control_point')
    .eq('unit', UNIT)
    .eq('section', SECTION)
    .order('created_at', { ascending: false })

  if (type) query.eq('type', type)
  return query
}

export async function createOrder({ type, title, body, authorName, controlPoint }) {
  return supabase.from('orders').insert({
    unit: UNIT,
    section: SECTION,
    type,
    title,
    body,
    author_name: authorName || null,
    control_point: controlPoint || null,
  })
}
