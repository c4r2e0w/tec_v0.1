import {
  createOverride,
  createScheduleEntry,
  fetchEmployeesByUnit,
  fetchOverridesRange,
  fetchScheduleRange,
  fetchShiftTemplates,
} from '../api/schedule'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export function createScheduleService(supabase) {
  return {
    fetchRange: ({ from, to, unit }) => fetchScheduleRange({ supabase, from, to, unit }),
    fetchOverrides: ({ from, to, unit }) => fetchOverridesRange({ supabase, from, to, unit }),
    fetchEmployeesByUnit: (unit) => fetchEmployeesByUnit({ supabase, unit }),
    fetchShiftTemplates: () => fetchShiftTemplates({ supabase }),
    createEntry: (payload) => createScheduleEntry({ supabase, payload }),
    createOverride: (payload) => createOverride({ supabase, payload }),
  }
}
