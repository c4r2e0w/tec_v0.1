import { acknowledgeEntry, createEntry, fetchEntries, fetchJournalRead, markJournalRead } from '../api/entries'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export function createEntriesService(supabase) {
  return {
    list: ({ journalCode, journalName, profileId }) =>
      fetchEntries({ supabase, journalCode, journalName, profileId }),
    create: ({ journalCode, journalName, profileId, payload }) =>
      createEntry({ supabase, journalCode, journalName, profileId, payload }),
    acknowledge: ({ entryId, profileId }) => acknowledgeEntry({ supabase, entryId, profileId }),
    markRead: ({ journalId, journalCode, journalName, profileId }) =>
      markJournalRead({ supabase, journalId, journalCode, journalName, profileId }),
    lastRead: ({ profileId, journalCode }) => fetchJournalRead({ supabase, profileId, journalCode }),
  }
}
