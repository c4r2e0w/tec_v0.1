import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'
import { createShiftHandoverService } from '../services/shiftHandoverService'

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .trim()

const inferUnitCode = (text) => {
  const value = normalize(text)
  if (value.includes('котлотурбин')) return 'ktc'
  if (value.includes('хим')) return 'chem'
  if (value.includes('электро')) return 'electro'
  if (value.includes('автомат')) return 'sai'
  if (value.includes('топлив')) return 'fuel'
  return 'ktc'
}

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

const getCurrentShiftSlot = () => {
  const now = new Date()
  const today = toIsoLocalDate(now)
  const type = now.getHours() >= 21 || now.getHours() < 9 ? 'night' : 'day'
  const date = type === 'night' && now.getHours() < 9 ? addDays(today, -1) : today
  return { date, type }
}

const shiftTypeLabel = (type) => (type === 'night' ? 'Ночь' : 'День')
const shiftPeriodLabel = (type) => (type === 'night' ? '21:00–09:00' : '09:00–21:00')
const isShiftChiefPosition = (name) => normalize(name).includes('начальник смен')

function EmployeeWorkspacePage() {
  const { employeeId } = useParams()
  const supabase = useSupabase()
  const profile = useProfile()
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const [employee, setEmployee] = useState(null)
  const [employeeError, setEmployeeError] = useState('')
  const [loadingEmployee, setLoadingEmployee] = useState(true)
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [shiftDate, setShiftDate] = useState(() => getCurrentShiftSlot().date)
  const [shiftType, setShiftType] = useState(() => getCurrentShiftSlot().type)
  const [sessionId, setSessionId] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [workplaces, setWorkplaces] = useState([])
  const [draftByWorkplace, setDraftByWorkplace] = useState({})
  const [loadingShiftControl, setLoadingShiftControl] = useState(false)
  const [savingShiftControl, setSavingShiftControl] = useState(false)
  const [shiftControlError, setShiftControlError] = useState('')
  const [shiftControlMessage, setShiftControlMessage] = useState('')
  const [operationsLog, setOperationsLog] = useState([])
  const [loadingOperationsLog, setLoadingOperationsLog] = useState(false)

  const employeeFio = useMemo(
    () =>
      employee
        ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
        : '',
    [employee],
  )
  const preferredUnit = useMemo(
    () => inferUnitCode(employee?.positions?.devision_name || employee?.positions?.departament_name || ''),
    [employee],
  )
  const isChiefKtc = useMemo(
    () => preferredUnit === 'ktc' && isShiftChiefPosition(employee?.positions?.name || ''),
    [preferredUnit, employee?.positions?.name],
  )
  const canManageShift = useMemo(
    () => Number(profile?.employee?.id) === Number(employee?.id) && isChiefKtc,
    [profile?.employee?.id, employee?.id, isChiefKtc],
  )
  const employeeOptions = useMemo(() => {
    const map = new Map()
    for (const row of assignments || []) {
      if (row?.is_present === false || !row?.employees?.id) continue
      const fio = [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
      map.set(String(row.employees.id), {
        id: row.employees.id,
        label: fio || `ID ${row.employees.id}`,
      })
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [assignments])
  const rowsBySection = useMemo(() => {
    const byCode = new Map((assignments || []).map((row) => [String(row.workplace_code || ''), row]))
    return (workplaces || [])
      .map((wp) => {
        const code = String(wp.code || wp.id || '')
        const assigned = byCode.get(code)
        return {
          code,
          name: wp.name || code,
          section: normalize(wp.name).includes('кот') ? 'boiler' : normalize(wp.name).includes('турб') ? 'turbine' : 'other',
          selectedEmployeeId: draftByWorkplace[code] || (assigned?.employee_id ? String(assigned.employee_id) : ''),
          assignedFio:
            assigned?.employees
              ? [assigned.employees.last_name, assigned.employees.first_name, assigned.employees.middle_name].filter(Boolean).join(' ')
              : '',
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [workplaces, assignments, draftByWorkplace])
  const chiefWorkplaceLink = useMemo(() => {
    if (!isChiefKtc) return null
    const ownAssignment = (assignments || []).find(
      (row) => Number(row?.employee_id) === Number(employeeId) && row?.is_present !== false,
    )
    const ownCode = String(ownAssignment?.workplace_code || '').trim()
    if (ownCode) {
      const ownWp = (workplaces || []).find((wp) => String(wp?.code || '').trim() === ownCode)
      if (ownWp?.id) return `/workplaces/${preferredUnit}/${ownWp.id}`
    }
    const chiefWp = (workplaces || []).find((wp) => normalize(wp?.name).includes('начальник смен'))
    if (chiefWp?.id) return `/workplaces/${preferredUnit}/${chiefWp.id}`
    return null
  }, [isChiefKtc, assignments, employeeId, workplaces, preferredUnit])

  useEffect(() => {
    let active = true
    async function loadEmployee() {
      setLoadingEmployee(true)
      setEmployeeError('')
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, middle_name, positions:position_id(name, type, devision_name, departament_name)')
        .eq('id', Number(employeeId))
        .maybeSingle()
      if (!active) return
      if (error) {
        setEmployeeError(error.message || 'Не удалось загрузить сотрудника')
        setEmployee(null)
      } else {
        setEmployee(data || null)
      }
      setLoadingEmployee(false)
    }
    void loadEmployee()
    return () => {
      active = false
    }
  }, [employeeId, supabase])

  useEffect(() => {
    let active = true
    async function loadShiftControl() {
      if (!isChiefKtc) {
        setSessionId(null)
        setAssignments([])
        setWorkplaces([])
        setDraftByWorkplace({})
        return
      }
      setLoadingShiftControl(true)
      setShiftControlError('')
      setShiftControlMessage('')
      const [sessionRes, workplacesRes] = await Promise.all([
        handoverService.fetchSession({ unit: preferredUnit, shiftDate: shiftDate, shiftType }),
        supabase.from('workplace').select('id, unit, code, name').eq('unit', preferredUnit).order('name', { ascending: true }),
      ])
      if (!active) return
      if (sessionRes?.error) {
        setShiftControlError(sessionRes.error.message || 'Не удалось загрузить смену')
        setLoadingShiftControl(false)
        return
      }
      const sid = sessionRes?.data?.id || null
      setSessionId(sid)
      setWorkplaces(workplacesRes?.data || [])
      if (!sid) {
        setAssignments([])
        setDraftByWorkplace({})
        setLoadingShiftControl(false)
        return
      }
      const assRes = await handoverService.fetchAssignments({ sessionId: sid })
      if (!active) return
      if (assRes?.error) {
        setShiftControlError(assRes.error.message || 'Не удалось загрузить состав смены')
        setAssignments([])
      } else {
        setAssignments(assRes.data || [])
        const nextDraft = {}
        ;(assRes.data || []).forEach((row) => {
          if (row?.is_present === false) return
          const code = String(row.workplace_code || '')
          if (!code || !row?.employee_id) return
          if (!nextDraft[code]) nextDraft[code] = String(row.employee_id)
        })
        setDraftByWorkplace(nextDraft)
      }
      setLoadingShiftControl(false)
    }
    void loadShiftControl()
    return () => {
      active = false
    }
  }, [handoverService, isChiefKtc, preferredUnit, shiftDate, shiftType, supabase])

  useEffect(() => {
    let active = true
    async function loadOperationalJournal() {
      if (!isChiefKtc) {
        setOperationsLog([])
        return
      }
      setLoadingOperationsLog(true)
      const shiftDateTag = `shift_date:${shiftDate}`
      const shiftTypeTag = `shift_type:${shiftType}`
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, type, unit, created_at, tags')
        .eq('unit', preferredUnit)
        .eq('type', 'daily')
        .contains('tags', [shiftDateTag, shiftTypeTag])
        .order('created_at', { ascending: true })
        .limit(500)
      if (!active) return
      if (error) {
        setOperationsLog([])
      } else {
        setOperationsLog(data || [])
      }
      setLoadingOperationsLog(false)
    }
    void loadOperationalJournal()
    return () => {
      active = false
    }
  }, [isChiefKtc, preferredUnit, shiftDate, shiftType, supabase])

  useEffect(() => {
    let active = true
    async function loadPosts() {
      setLoadingPosts(true)
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, type, unit, created_at, created_by_employee_id')
        .eq('created_by_employee_id', Number(employeeId))
        .order('created_at', { ascending: false })
        .limit(10)
      if (!active) return
      if (error) {
        setPosts([])
      } else {
        setPosts(data || [])
      }
      setLoadingPosts(false)
    }
    void loadPosts()
    return () => {
      active = false
    }
  }, [employeeId, supabase])

  const handleSaveShiftDraft = async () => {
    if (!sessionId || !canManageShift) return
    setSavingShiftControl(true)
    setShiftControlError('')
    setShiftControlMessage('')
    const existingByEmployee = new Map()
    for (const row of assignments || []) {
      if (!row?.employee_id) continue
      existingByEmployee.set(String(row.employee_id), row)
    }
    const selectedPairs = Object.entries(draftByWorkplace).filter(([, employee]) => String(employee || '').trim())
    const usedEmployees = new Set()
    const payload = []
    for (const [workplaceCode, employeeValue] of selectedPairs) {
      const employee = String(employeeValue)
      if (usedEmployees.has(employee)) continue
      usedEmployees.add(employee)
      const sourceRow = existingByEmployee.get(employee)
      payload.push({
        session_id: sessionId,
        employee_id: Number(employee),
        workplace_code: workplaceCode,
        position_name: sourceRow?.position_name || null,
        source: 'manual',
        is_present: true,
        confirmed_by_chief: true,
        confirmed_at: new Date().toISOString(),
      })
    }
    for (const row of assignments || []) {
      const employee = String(row?.employee_id || '')
      if (!employee || usedEmployees.has(employee)) continue
      payload.push({
        session_id: sessionId,
        employee_id: Number(employee),
        workplace_code: row.workplace_code,
        position_name: row.position_name || null,
        source: 'manual',
        is_present: false,
        confirmed_by_chief: true,
        confirmed_at: new Date().toISOString(),
      })
    }
    const res = await handoverService.upsertAssignments(payload)
    setSavingShiftControl(false)
    if (res?.error) {
      setShiftControlError(res.error.message || 'Не удалось сохранить состав смены')
      return
    }
    setShiftControlMessage('Состав смены сохранен')
    const refreshed = await handoverService.fetchAssignments({ sessionId })
    if (!refreshed?.error) setAssignments(refreshed.data || [])
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Страница сотрудника</p>
        {loadingEmployee && <p className="mt-2 text-sm text-slate-300">Загрузка профиля…</p>}
        {!loadingEmployee && employee && (
          <>
            <h2 className="mt-2 text-xl font-semibold text-white">{employeeFio}</h2>
            <p className="mt-1 text-xs text-slate-400">{employee.positions?.name || 'Должность не указана'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {employee.positions?.devision_name || '—'} · {employee.positions?.departament_name || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/${preferredUnit}/personnel`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                Календарь подразделения
              </Link>
              <Link
                to="/"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                На главную
              </Link>
            </div>
          </>
        )}
        {!loadingEmployee && !employee && (
          <p className="mt-2 text-sm text-rose-300">{employeeError || 'Сотрудник не найден'}</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Публикации и действия</h3>
        {loadingPosts && <p className="mt-3 text-xs text-slate-400">Загружаем активность…</p>}
        {!loadingPosts && !posts.length && (
          <p className="mt-3 text-xs text-slate-500">Пока нет публикаций в ленте от этого сотрудника.</p>
        )}
        <div className="mt-3 space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-white">{post.title || 'Запись'}</p>
              <p className="mt-1 text-xs text-slate-300">{post.body || '—'}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                {post.type || 'info'} · {post.unit || 'общий'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {isChiefKtc && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Управление сменой КТЦ</h3>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShiftDate((prev) => addDays(prev, -1))}
                className="rounded-full border border-white/10 px-2 py-1 text-slate-200"
              >
                ←
              </button>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                {new Date(shiftDate).toLocaleDateString('ru-RU')} · {shiftTypeLabel(shiftType)}
              </span>
              <button
                type="button"
                onClick={() => setShiftType((prev) => (prev === 'day' ? 'night' : 'day'))}
                className="rounded-full border border-white/10 px-2 py-1 text-slate-200"
              >
                {shiftType === 'day' ? '☀︎' : '☾'}
              </button>
              <button
                type="button"
                onClick={() => setShiftDate((prev) => addDays(prev, 1))}
                className="rounded-full border border-white/10 px-2 py-1 text-slate-200"
              >
                →
              </button>
            </div>
          </div>
          {chiefWorkplaceLink && (
            <div className="mt-2">
              <Link
                to={chiefWorkplaceLink}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                Перейти на рабочее место НС КТЦ
              </Link>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            {new Date(shiftDate).toLocaleDateString('ru-RU')} · {shiftTypeLabel(shiftType)} · Период {shiftPeriodLabel(shiftType)}
          </p>
          {loadingShiftControl && <p className="mt-2 text-xs text-slate-400">Загрузка состава смены…</p>}
          {sessionId == null && !loadingShiftControl && (
            <p className="mt-2 text-xs text-slate-500">Сессия смены для этой даты не найдена.</p>
          )}
          {!!sessionId && (
            <>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {['boiler', 'turbine'].map((sectionKey) => (
                  <div key={sectionKey} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                      {sectionKey === 'boiler' ? 'Котельное' : 'Турбинное'}
                    </p>
                    <div className="mt-2 space-y-2">
                      {rowsBySection
                        .filter((row) => row.section === sectionKey)
                        .map((row) => (
                          <div key={row.code}>
                            <p className="text-xs text-slate-300">{row.name}</p>
                            {canManageShift ? (
                              <select
                                value={row.selectedEmployeeId}
                                onChange={(e) =>
                                  setDraftByWorkplace((prev) => ({ ...prev, [row.code]: String(e.target.value || '') }))
                                }
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                              >
                                <option value="">—</option>
                                {employeeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-xs text-slate-100">{row.assignedFio || '—'}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              {canManageShift && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveShiftDraft()}
                    disabled={savingShiftControl}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {savingShiftControl ? 'Сохраняем...' : 'Сохранить состав смены'}
                  </button>
                  {shiftControlMessage && <span className="text-xs text-emerald-300">{shiftControlMessage}</span>}
                  {shiftControlError && <span className="text-xs text-rose-300">{shiftControlError}</span>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isChiefKtc && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Оперативный журнал НС КТЦ</h3>
          <p className="mt-1 text-xs text-slate-400">
            Сводные события из суточных ведомостей рабочих мест и сменных журналов за выбранную смену.
          </p>
          {loadingOperationsLog && <p className="mt-3 text-xs text-slate-400">Загрузка записей…</p>}
          {!loadingOperationsLog && !operationsLog.length && (
            <p className="mt-3 text-xs text-slate-500">За эту смену пока нет записей.</p>
          )}
          <div className="mt-3 space-y-2">
            {operationsLog.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-500">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
                <p className="text-sm font-semibold text-white">{item.title || 'Запись'}</p>
                <p className="mt-1 text-xs text-slate-300">{item.body || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeWorkspacePage
