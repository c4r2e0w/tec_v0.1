import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'

const toIsoLocalDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const addDays = (dateStr, days) => {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map((v) => Number(v))
  const date = new Date(y, (m || 1) - 1, d || 1)
  date.setDate(date.getDate() + days)
  return toIsoLocalDate(date)
}

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

function WorkplacePage() {
  const { unit, workplaceId } = useParams()
  const supabase = useSupabase()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const [workplace, setWorkplace] = useState(null)
  const [assignee, setAssignee] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const { data: wpData, error: wpError } = await scheduleService.fetchWorkplaces({ unit })
      if (!active) return
      if (wpError) {
        setError(wpError.message || 'Не удалось загрузить рабочее место')
        setLoading(false)
        return
      }
      const wp = (wpData || []).find((item) => String(item.id) === String(workplaceId))
      setWorkplace(wp || null)

      const now = new Date()
      const today = toIsoLocalDate(now)
      const shiftType = now.getHours() >= 21 || now.getHours() < 9 ? 'night' : 'day'
      const shiftDate = shiftType === 'night' && now.getHours() < 9 ? addDays(today, -1) : today
      const sessionRes = await handoverService.fetchSession({ unit, shiftDate, shiftType })
      if (!active) return
      const sessionId = sessionRes?.data?.id
      if (!sessionId) {
        setAssignee(null)
        setLoading(false)
        return
      }
      const assignmentsRes = await handoverService.fetchAssignments({ sessionId })
      if (!active) return
      const wpIdKey = normalizeKey(workplaceId)
      const wpCodeKey = normalizeKey(wp?.code)
      const assignment = (assignmentsRes?.data || []).find((row) => {
        if (row?.is_present === false) return false
        const assignmentKey = normalizeKey(row?.workplace_code)
        if (!assignmentKey) return false
        if (assignmentKey === wpIdKey) return true
        if (wpCodeKey && assignmentKey === wpCodeKey) return true
        return false
      })
      if (assignment?.employees) {
        const fio = [assignment.employees.last_name, assignment.employees.first_name, assignment.employees.middle_name]
          .filter(Boolean)
          .join(' ')
        setAssignee({ id: assignment.employee_id, fio: fio || `ID ${assignment.employee_id}` })
      } else {
        setAssignee(null)
      }
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [handoverService, scheduleService, unit, workplaceId])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Рабочее место</p>
        {loading && <p className="mt-2 text-sm text-slate-300">Загрузка…</p>}
        {!loading && (
          <>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {workplace?.name || workplace?.code || `Пост ${workplaceId}`}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Код: {workplace?.code || '—'} · Подразделение: {workplace?.unit || unit}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Позиция: {workplace?.position_name || workplace?.position_id || workplace?.description || '—'}
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Текущий сотрудник</p>
              {assignee ? (
                <Link
                  to={`/people/${assignee.id}`}
                  className="mt-2 inline-flex rounded-full border border-emerald-400/45 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 transition hover:border-emerald-300"
                >
                  {assignee.fio}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-300">Не назначен</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/${unit}/personnel`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                К персоналу
              </Link>
              <Link
                to="/rounds/today"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                Обход сегодня
              </Link>
            </div>
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export default WorkplacePage
