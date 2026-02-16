import {
  createOverride,
  createScheduleEntry,
  deleteScheduleEntry,
  fetchEmployeesByUnit,
  fetchOverridesRange,
  fetchPositions,
  fetchScheduleRange,
  fetchShiftTemplates,
  fetchWorkplaces,
} from '../api/schedule'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export function createScheduleService(supabase) {
  return {
    fetchRange: ({ from, to, unit }) => fetchScheduleRange({ supabase, from, to, unit }),
    fetchOverrides: ({ from, to, unit }) => fetchOverridesRange({ supabase, from, to, unit }),
    fetchEmployeesByUnit: (filters) => fetchEmployeesByUnit({ supabase, filters }),
    fetchPositions: () => fetchPositions({ supabase }),
    fetchWorkplaces: ({ unit }) => fetchWorkplaces({ supabase, unit }),
    fetchShiftTemplates: () => fetchShiftTemplates({ supabase }),
    createEntry: (payload) => createScheduleEntry({ supabase, payload }),
    deleteEntry: ({ employeeId, date }) => deleteScheduleEntry({ supabase, employeeId, date }),
    createOverride: (payload) => createOverride({ supabase, payload }),
  }
}
