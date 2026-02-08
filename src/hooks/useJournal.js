import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSupabase } from '../context/SupabaseProvider'
import { createEntriesService } from '../services/entriesService'

export function useJournal({ enabled, journalCode, journalName, profileId }) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const entriesService = useMemo(() => createEntriesService(supabase), [supabase])
  const [entriesError, setEntriesError] = useState('')
  const [ackLoadingId, setAckLoadingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const entriesQuery = useQuery({
    queryKey: ['journal-entries', journalCode, profileId],
    enabled: enabled && !!profileId,
    queryFn: async () => {
      const { data, error, journalId } = await entriesService.list({ journalCode, journalName, profileId })
      if (error) throw new Error(error.message)
      return { entries: data || [], journalId: journalId || null }
    },
  })

  const journalId = entriesQuery.data?.journalId || null

  const lastReadQuery = useQuery({
    queryKey: ['journal-last-read', journalCode, journalId, profileId],
    enabled: enabled && !!profileId && !!journalId,
    queryFn: async () => {
      const { data, error } = await entriesService.lastRead({
        profileId,
        journalCode,
        journalName,
        journalId,
      })
      if (error) throw new Error(error.message)
      return data?.last_seen_at || null
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      if (!journalId) throw new Error('Журнал не найден')
      const { error } = await entriesService.create({
        journalCode,
        journalName,
        journalId,
        profileId,
        payload,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['journal-entries', journalCode, profileId] })
    },
    onError: (err) => setEntriesError(err.message),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ entryId }) => {
      const { error } = await entriesService.acknowledge({ entryId, profileId })
      if (error) throw new Error(error.message)
      return entryId
    },
    onSuccess: (entryId) => {
      queryClient.setQueryData(['journal-entries', journalCode, profileId], (prev) => {
        if (!prev?.entries) return prev
        return {
          ...prev,
          entries: prev.entries.map((item) =>
            item.id === entryId
              ? {
                  ...item,
                  acknowledged: true,
                  receipts: [...(item.receipts || []), { profile_id: profileId, acknowledged_at: new Date().toISOString() }],
                }
              : item,
          ),
        }
      })
    },
    onError: (err) => setEntriesError(err.message),
  })

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!journalId) throw new Error('Журнал не найден')
      const { error } = await entriesService.markRead({
        journalId,
        journalCode,
        journalName,
        profileId,
      })
      if (error) throw new Error(error.message)
      return new Date().toISOString()
    },
    onSuccess: (nowIso) => {
      queryClient.setQueryData(['journal-last-read', journalCode, journalId, profileId], nowIso)
    },
    onError: (err) => setEntriesError(err.message),
  })

  const refreshEntries = async () => {
    setRefreshing(true)
    setEntriesError('')
    try {
      await entriesQuery.refetch()
      if (journalId) {
        await lastReadQuery.refetch()
      }
    } finally {
      setRefreshing(false)
    }
  }

  const acknowledgeEntry = async (entryId) => {
    if (!profileId) return
    setAckLoadingId(entryId)
    setEntriesError('')
    try {
      await acknowledgeMutation.mutateAsync({ entryId })
    } finally {
      setAckLoadingId(null)
    }
  }

  return {
    entries: entriesQuery.data?.entries || [],
    journalId,
    lastSeenAt: lastReadQuery.data || null,
    loadingEntries: entriesQuery.isLoading || lastReadQuery.isLoading,
    refreshing,
    entriesError: entriesError || entriesQuery.error?.message || lastReadQuery.error?.message || '',
    saving: createMutation.isPending,
    ackLoadingId,
    markAllLoading: markReadMutation.isPending,
    createEntry: (payload) => createMutation.mutateAsync(payload),
    acknowledgeEntry,
    markAllRead: () => markReadMutation.mutateAsync(),
    refreshEntries,
    clearEntriesError: () => setEntriesError(''),
    setEntriesError: (message) => setEntriesError(message || ''),
  }
}
