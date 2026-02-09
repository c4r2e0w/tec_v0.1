import {
  createShiftSession,
  fetchActiveShiftPermissions,
  fetchBriefingTopicForDate,
  fetchBriefingTopicsRange,
  fetchShiftAssignments,
  fetchShiftSession,
  upsertBriefingTopics,
  updateShiftSession,
  upsertShiftAssignments,
  upsertShiftPermissions,
} from '../api/shiftHandover'

export function createShiftHandoverService(supabase) {
  return {
    fetchTopicForDate: ({ unit, shiftDate }) => fetchBriefingTopicForDate({ supabase, unit, shiftDate }),
    fetchTopicsRange: ({ unit, from, to }) => fetchBriefingTopicsRange({ supabase, unit, from, to }),
    upsertTopics: (payload) => upsertBriefingTopics({ supabase, payload }),
    fetchSession: ({ unit, shiftDate, shiftType }) => fetchShiftSession({ supabase, unit, shiftDate, shiftType }),
    createSession: (payload) => createShiftSession({ supabase, payload }),
    updateSession: ({ sessionId, payload }) => updateShiftSession({ supabase, sessionId, payload }),
    fetchAssignments: ({ sessionId }) => fetchShiftAssignments({ supabase, sessionId }),
    upsertAssignments: (payload) => upsertShiftAssignments({ supabase, payload }),
    upsertPermissions: (payload) => upsertShiftPermissions({ supabase, payload }),
    fetchActivePermissions: ({ sessionId, employeeId }) => fetchActiveShiftPermissions({ supabase, sessionId, employeeId }),
  }
}
