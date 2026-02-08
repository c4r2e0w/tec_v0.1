// Журналы и записи (directive/defect/daily/ktc-docs)

export function journalCodeFrom(unit, section) {
  if (unit && section) return `${unit}-${section}`
  if (unit) return `${unit}-generic`
  if (section) return `generic-${section}`
  return 'generic'
}

async function resolveJournalId({ supabase, journalCode, journalId, journalName }) {
  if (journalId) return { journalId, error: null }
  const { data, error } = await supabase.from('journals').select('id').eq('code', journalCode).maybeSingle()
  if (error) return { journalId: null, error }
  if (data?.id) return { journalId: data.id, error: null }
  const label = journalName || journalCode
  return {
    journalId: null,
    error: new Error(`Журнал "${label}" не найден в БД (code=${journalCode})`),
  }
}

export async function fetchEntries({ supabase, journalCode, journalId, types, profileId, journalName }) {
  if (!supabase) return { data: [], error: new Error('Supabase не сконфигурирован') }
  const resolved = await resolveJournalId({ supabase, journalCode, journalId, journalName })
  if (resolved.error) return { data: [], error: resolved.error }

  let query = supabase
    .from('entries')
    .select(
      `
      id,
      journal_id,
      title,
      body,
      type,
      created_at,
      unit,
      tags,
      attachments,
      author_snapshot,
      created_by_profile_id,
      created_by_employee_id,
      receipts:entry_receipts ( profile_id, acknowledged_at )
    `,
    )
    .eq('journal_id', resolved.journalId)
    .order('created_at', { ascending: false })

  if (types && types.length) {
    query = query.in('type', types)
  }
  const { data, error } = await query
  if (error) return { data: [], error }

  const withFlags = data.map((item) => {
    const acknowledged = !!item.receipts?.some((r) => r.profile_id === profileId)
    return { ...item, acknowledged }
  })
  return { data: withFlags, error: null, journalId: resolved.journalId }
}

export async function createEntry({ supabase, journalCode, journalId, payload, journalName, profileId }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const resolved = await resolveJournalId({ supabase, journalCode, journalId, journalName })
  if (resolved.error) return { data: null, error: resolved.error }
  return supabase
    .from('entries')
    .insert({ ...payload, journal_id: resolved.journalId, created_by_profile_id: profileId })
    .select()
    .maybeSingle()
}

export async function acknowledgeEntry({ supabase, entryId, profileId }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  return supabase
    .from('entry_receipts')
    .upsert({ entry_id: entryId, profile_id: profileId, acknowledged_at: new Date().toISOString() }, { onConflict: 'entry_id,profile_id' })
}

export async function fetchJournalRead({ supabase, journalCode, journalId, profileId, journalName }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const resolved = await resolveJournalId({ supabase, journalCode, journalId, journalName })
  if (resolved.error) return { data: null, error: resolved.error }
  return supabase
    .from('entry_reads')
    .select('last_seen_at, profile_id, journal_id')
    .eq('journal_id', resolved.journalId)
    .eq('profile_id', profileId)
    .maybeSingle()
}

export async function markJournalRead({ supabase, journalCode, journalId, profileId, journalName }) {
  if (!supabase) return { data: null, error: new Error('Supabase не сконфигурирован') }
  const resolved = await resolveJournalId({ supabase, journalCode, journalId, journalName })
  if (resolved.error) return { data: null, error: resolved.error }
  return supabase
    .from('entry_reads')
    .upsert({ journal_id: resolved.journalId, profile_id: profileId, last_seen_at: new Date().toISOString() }, { onConflict: 'journal_id,profile_id' })
}
