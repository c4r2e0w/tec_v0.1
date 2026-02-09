import {
  fetchMyRoundRuns,
  fetchRoundRun,
  fetchRoundRunChecks,
  fetchRoundRunFiles,
  fetchWorkplacesDictionary,
  insertRoundRunFile,
  rpcConfirmShiftBriefing,
  rpcCreateOrGetShiftBriefing,
  rpcGetMyShiftToday,
  rpcStartRoundForToday,
  updateRoundCheck,
  updateRoundRun,
} from '../api/shiftWorkflow'

export function createShiftWorkflowService(supabase) {
  return {
    createOrGetBriefing: ({ date, unit, shiftType }) =>
      rpcCreateOrGetShiftBriefing({ supabase, date, unit, shiftType }),
    confirmBriefing: ({ briefingId }) => rpcConfirmShiftBriefing({ supabase, briefingId }),
    getMyShiftToday: ({ unit }) => rpcGetMyShiftToday({ supabase, unit }),
    startRoundForToday: ({ unit }) => rpcStartRoundForToday({ supabase, unit }),
    fetchWorkplaces: ({ unit }) => fetchWorkplacesDictionary({ supabase, unit }),
    fetchRun: ({ runId }) => fetchRoundRun({ supabase, runId }),
    fetchRunChecks: ({ runId }) => fetchRoundRunChecks({ supabase, runId }),
    fetchRunFiles: ({ checkIds }) => fetchRoundRunFiles({ supabase, checkIds }),
    updateRun: ({ runId, payload }) => updateRoundRun({ supabase, runId, payload }),
    updateCheck: ({ checkId, payload }) => updateRoundCheck({ supabase, checkId, payload }),
    insertRunFile: ({ payload }) => insertRoundRunFile({ supabase, payload }),
    fetchMyRuns: ({ from, to, status }) => fetchMyRoundRuns({ supabase, from, to, status }),
  }
}
