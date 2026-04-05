import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-[#10271e] via-[#0f3124] to-[#132018]' },
  chem: { name: 'Химический цех', color: 'from-[#1b2027] via-[#15384a] to-[#1d252a]' },
  electro: { name: 'Электроцех', color: 'from-[#16261d] via-[#17402a] to-[#102019]' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-[#191d23] via-[#22313c] to-[#161a1f]' },
  fuel: { name: 'Цех топливоподачи', color: 'from-[#241e16] via-[#3a2a19] to-[#1f1a14]' },
}

const toIsoLocalDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseIsoLocalDate = (dateStr) => {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map((value) => Number(value))
  return new Date(y, (m || 1) - 1, d || 1)
}

const addDaysLocalIso = (dateStr, days) => {
  const d = parseIsoLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return toIsoLocalDate(d)
}
const SHIFT_ANCHOR_DATE = '2026-02-09' // day shift = А
const SHIFT_CODES = ['А', 'Б', 'В', 'Г']

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const workplaceDivision = (workplace) => {
  const raw = [
    workplace?.unit,
    workplace?.division_name,
    workplace?.devision_name,
    workplace?.division,
    workplace?.department_name,
    workplace?.departament_name,
    workplace?.departament_id,
    workplace?.department,
    workplace?.description,
    workplace?.position_id,
    workplace?.section,
    workplace?.area,
    workplace?.name,
    workplace?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (raw.includes('котел') || raw.includes('котель')) return 'boiler'
  if (raw.includes('турбин')) return 'turbine'
  return 'other'
}

const isReserveWorkplace = (workplace) => {
  const raw = [workplace?.name, workplace?.code, workplace?.section, workplace?.area]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return raw.includes('резерв') || raw.includes('без пост')
}
const isChiefWorkplace = (workplace) => {
  const raw = [
    workplace?.name,
    workplace?.code,
    workplace?.position_name,
    workplace?.position_id,
    workplace?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return raw.includes('нс ктц') || raw.includes('начальник смены')
}

const isChiefPosition = (value) => {
  const normalized = normalizeText(value).replace(/\./g, ' ')
  return normalized.includes('начальник смены') || normalized.includes('нач смены') || (normalized.includes('начальник') && normalized.includes('смен'))
}
const isOperationalType = (value) => normalizeText(value).includes('оператив')

const employeeDivision = (employee) => {
  const division = normalizeText(employee?.division)
  const department = normalizeText(employee?.department)
  if (division.includes('котел') || division.includes('котель') || department.includes('котел') || department.includes('котель'))
    return 'boiler'
  if (division.includes('турбин') || department.includes('турбин')) return 'turbine'

  const pos = normalizeText(employee?.position)
  const hasBoiler = pos.includes('котел') || pos.includes('котель')
  const hasTurbine = pos.includes('турбин')
  if (hasBoiler && !hasTurbine) return 'boiler'
  if (hasTurbine && !hasBoiler) return 'turbine'
  return 'other'
}
function UnitLandingPage() {
  const { unit } = useParams()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const data = units[unit]
  const [shiftSummary, setShiftSummary] = useState({
    loading: false,
    error: '',
    notice: '',
    shiftCode: '—',
    shiftType: 'day',
    shiftDate: '',
    chief: '',
    chiefId: null,
    chiefWorkplaceId: null,
    boilerRows: [],
    turbineRows: [],
  })

  const getShiftCodeByDate = (dateStr, shiftType) => {
    const diffMs = parseIsoLocalDate(dateStr).getTime() - parseIsoLocalDate(SHIFT_ANCHOR_DATE).getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    const dayIndex = ((diffDays % SHIFT_CODES.length) + SHIFT_CODES.length) % SHIFT_CODES.length
    const index = shiftType === 'night' ? ((dayIndex - 1 + SHIFT_CODES.length) % SHIFT_CODES.length) : dayIndex
    return SHIFT_CODES[index] || '—'
  }

  useEffect(() => {
    if (unit !== 'ktc') {
      setShiftSummary({
        loading: false,
        error: '',
        notice: '',
        shiftCode: '—',
        shiftType: 'day',
        shiftDate: '',
        chief: '',
        chiefId: null,
        chiefWorkplaceId: null,
        boilerRows: [],
        turbineRows: [],
      })
      return
    }
    const load = async () => {
      const now = new Date()
      const currentDate = toIsoLocalDate(now)
      const currentType = now.getHours() >= 21 || now.getHours() < 9 ? 'night' : 'day'
      const shiftDate = currentType === 'night' && now.getHours() < 9 ? addDaysLocalIso(currentDate, -1) : currentDate
      const nextDate = addDaysLocalIso(shiftDate, 1)
      setShiftSummary((prev) => ({ ...prev, loading: true, error: '' }))
      const [{ data: rows, error }, workplacesRes] = await Promise.all([
        scheduleService.fetchRange({
          from: shiftDate,
          to: currentType === 'night' ? nextDate : shiftDate,
          unit,
        }),
        scheduleService.fetchWorkplaces({ unit }),
      ])
      if (error) {
        setShiftSummary((prev) => ({ ...prev, loading: false, error: error.message }))
        return
      }
      if (workplacesRes.error) {
        setShiftSummary((prev) => ({ ...prev, loading: false, error: workplacesRes.error.message }))
        return
      }
      const byEmpDay = new Map()
      ;(rows || []).forEach((row) => {
        const key = `${row.employee_id}|${row.date}`
        const list = byEmpDay.get(key) || []
        list.push(row)
        byEmpDay.set(key, list)
      })
      const employees = new Map()
      ;(rows || []).forEach((row) => {
        if (employees.has(row.employee_id)) return
        const fullName = row.employees
          ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
          : `ID ${row.employee_id}`
        employees.set(row.employee_id, {
          id: row.employee_id,
          name: fullName,
          position: row.employees?.positions?.name || '',
          division: row.employees?.positions?.devision_name || '',
          department: row.employees?.positions?.departament_name || '',
          positionType: row.employees?.positions?.type || '',
        })
      })
      const activeEmployees = Array.from(employees.values()).filter((emp) => {
        if (!isOperationalType(emp.positionType)) return false
        const dayEntries = byEmpDay.get(`${emp.id}|${shiftDate}`) || []
        if (currentType === 'day') {
          return dayEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 12)
        }
        return dayEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 3)
      })

      const workplaces = workplacesRes.data || []
      const byWpId = new Map(workplaces.map((wp) => [String(wp.id), wp]))
      const byWpCode = new Map(
        workplaces
          .filter((wp) => wp.code)
          .map((wp) => [normalizeText(wp.code), wp]),
      )
      let baseRows = workplaces
        .map((wp) => ({
          workplaceId: String(wp.id),
          workplaceName: String(wp.name || wp.code || `Пост ${wp.id}`),
          requiredPositionText: String(wp.position_id || wp.position_name || wp.position || wp.description || ''),
          divisionKey: workplaceDivision(wp),
          isReserve: isReserveWorkplace(wp),
          isChiefWorkplace: isChiefWorkplace(wp),
          employeeName: '',
        }))
        .filter((row) => (row.divisionKey === 'boiler' || row.divisionKey === 'turbine') && !row.isReserve && !row.isChiefWorkplace)

      if (!baseRows.length) {
        baseRows = activeEmployees
          .map((emp) => ({
            workplaceId: `emp-${emp.id}`,
            workplaceName: emp.position || `Сотрудник ${emp.id}`,
            requiredPositionText: emp.position || '',
            divisionKey: employeeDivision(emp),
            isReserve: false,
            employeeName: '',
          }))
          .filter((row) => row.divisionKey === 'boiler' || row.divisionKey === 'turbine')
      }

      const sessionRes = await handoverService.fetchSession({ unit, shiftDate, shiftType: currentType })
      const sessionId = sessionRes?.data?.id || null
      const sessionStatus = normalizeText(sessionRes?.data?.status)
      const isConfirmedSession = ['active', 'confirmed', 'closed'].includes(sessionStatus)
      let assignments = []
      if (sessionId && isConfirmedSession) {
        const assignmentsRes = await handoverService.fetchAssignments({ sessionId })
        if (!assignmentsRes.error) assignments = assignmentsRes.data || []
      }

      const assignmentByWorkplace = new Map()
      const occupiedEmployees = new Set()
      const occupiedNames = new Set()
      ;(assignments || [])
        .filter((a) => a?.is_present !== false)
        .forEach((a) => {
          const key = String(a.workplace_code || '')
          if (!key) return
          const empId = String(a.employee_id || '')
          if (!empId || occupiedEmployees.has(empId)) return
          const employee = a.employees
          const fullName = employee
            ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
            : `ID ${a.employee_id}`
          const fullNameKey = normalizeText(fullName)
          const wp = byWpId.get(key) || byWpCode.get(normalizeText(key))
          if (!wp) return
          if (isReserveWorkplace(wp)) return
          if (isChiefWorkplace(wp)) return
          const wpId = String(wp.id)
          if (assignmentByWorkplace.has(wpId)) return
          if (fullNameKey && occupiedNames.has(fullNameKey)) return
          assignmentByWorkplace.set(wpId, { employeeName: fullName, employeeId: a.employee_id || null })
          occupiedEmployees.add(empId)
          if (fullNameKey) occupiedNames.add(fullNameKey)
        })

      const rowsByWorkplace = baseRows.map((row) => ({
        ...row,
        employeeName: assignmentByWorkplace.get(row.workplaceId)?.employeeName || '',
        employeeId: assignmentByWorkplace.get(row.workplaceId)?.employeeId || null,
      }))

      const chiefFromAssignments =
        (assignments || [])
          .filter((a) => a?.is_present !== false)
          .find((a) => isChiefPosition(a.position_name || a.employees?.positions?.name))?.employees || null
      const chiefFromSessionId = sessionRes?.data?.chief_employee_id ? employees.get(sessionRes.data.chief_employee_id) : null
      const chiefWorkplaceFromAssignments =
        (assignments || [])
          .filter((a) => a?.is_present !== false)
          .map((a) => {
            const key = String(a.workplace_code || '')
            if (!key) return null
            return byWpId.get(key) || byWpCode.get(normalizeText(key)) || null
          })
          .find((wp) => wp && isChiefWorkplace(wp)) || null
      const defaultChiefWorkplace = (workplaces || []).find((wp) => isChiefWorkplace(wp)) || null

      const chief = chiefFromAssignments
        ? [chiefFromAssignments.last_name, chiefFromAssignments.first_name, chiefFromAssignments.middle_name].filter(Boolean).join(' ')
        : chiefFromSessionId?.name || ''
      const chiefId = chiefFromAssignments?.id || sessionRes?.data?.chief_employee_id || chiefFromSessionId?.id || null
      const chiefWorkplaceId =
        (chiefWorkplaceFromAssignments?.id ? String(chiefWorkplaceFromAssignments.id) : null) ||
        (defaultChiefWorkplace?.id ? String(defaultChiefWorkplace.id) : null)

      const boilerRows = rowsByWorkplace.filter((row) => row.divisionKey === 'boiler')
      const turbineRows = rowsByWorkplace.filter((row) => row.divisionKey === 'turbine')

      setShiftSummary({
        loading: false,
        error: '',
        notice: isConfirmedSession ? '' : 'Состав смены появится после подтверждения начальником смены.',
        shiftCode: getShiftCodeByDate(shiftDate, currentType),
        shiftType: currentType,
        shiftDate,
        chief,
        chiefId,
        chiefWorkplaceId,
        boilerRows,
        turbineRows,
      })
    }
    void load()
  }, [handoverService, scheduleService, unit])

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-sm text-dark">
        <p className="text-xs uppercase tracking-[0.25em] text-grayText">Подразделение</p>
        <p className="text-lg font-semibold text-dark">Раздел не найден</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${data.color} p-6 shadow-xl sm:p-8`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/70">Подразделение</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{data.name}</h1>
        <p className="mt-2 text-sm text-white/80">
          Выберите секцию: персонал, оборудование или документация. Можно перейти сразу по кнопкам ниже.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => navigate(`/${unit}/personnel`)}
            className="rounded-full bg-[#00A650] px-4 py-2 font-semibold text-white transition hover:bg-[#00bf5b]"
          >
            Персонал
          </button>
          <button
            onClick={() => navigate(`/${unit}/equipment`)}
            className="rounded-full border border-white/30 bg-white/5 px-4 py-2 text-white transition hover:border-[#f59e0b]/80 hover:bg-white/10"
          >
            Оборудование
          </button>
          <button
            onClick={() => navigate(`/${unit}/docs`)}
            className="rounded-full border border-white/30 bg-white/5 px-4 py-2 text-white transition hover:border-[#f59e0b]/80 hover:bg-white/10"
          >
            Документация
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4 text-sm text-dark">
          <p className="text-xs uppercase tracking-[0.25em] text-grayText">Персонал</p>
          {unit === 'ktc' ? (
            <>
              <p className="mt-2 text-dark">
                Сейчас на смене: вахта {shiftSummary.shiftCode} · {shiftSummary.shiftType === 'night' ? 'Ночь' : 'День'}
              </p>
              <p className="text-xs text-grayText">
                {shiftSummary.chiefWorkplaceId ? (
                  <Link to={`/workplaces/${unit}/${shiftSummary.chiefWorkplaceId}`} className="text-primary underline decoration-primary/50 underline-offset-2">
                    Начальник смены
                  </Link>
                ) : (
                  'Начальник смены'
                )}{' '}
                : <span className="text-dark">{shiftSummary.chief || 'не назначен'}</span>
              </p>
              <div className="mt-2 grid gap-2">
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-grayText">Котельное</p>
                  {shiftSummary.loading ? (
                    <p className="text-xs text-dark">Загрузка...</p>
                  ) : (
                    <div className="space-y-1 text-xs text-dark">
                      {(shiftSummary.boilerRows || []).map((row) => (
                        <div key={row.workplaceId} className="flex items-start justify-between gap-2 rounded-md border border-border/70 bg-white/40 px-2 py-1">
                          <Link to={`/workplaces/${unit}/${row.workplaceId}`} className="text-grayText underline decoration-grayText/40 underline-offset-2">
                            {row.workplaceName}
                          </Link>
                          <span className="text-right">{row.employeeName || '—'}</span>
                        </div>
                      ))}
                      {!shiftSummary.boilerRows?.length && <p>—</p>}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-grayText">Турбинное</p>
                  {shiftSummary.loading ? (
                    <p className="text-xs text-dark">Загрузка...</p>
                  ) : (
                    <div className="space-y-1 text-xs text-dark">
                      {(shiftSummary.turbineRows || []).map((row) => (
                        <div key={row.workplaceId} className="flex items-start justify-between gap-2 rounded-md border border-border/70 bg-white/40 px-2 py-1">
                          <Link to={`/workplaces/${unit}/${row.workplaceId}`} className="text-grayText underline decoration-grayText/40 underline-offset-2">
                            {row.workplaceName}
                          </Link>
                          <span className="text-right">{row.employeeName || '—'}</span>
                        </div>
                      ))}
                      {!shiftSummary.turbineRows?.length && <p>—</p>}
                    </div>
                  )}
                </div>
                {shiftSummary.notice && <p className="text-[11px] text-grayText">{shiftSummary.notice}</p>}
              </div>
              {shiftSummary.error && <p className="mt-2 text-xs text-red-300">Ошибка: {shiftSummary.error}</p>}
            </>
          ) : (
            <p className="mt-2 text-dark">Состав, контакты, роли</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-white p-4 text-sm text-dark">
          <p className="text-xs uppercase tracking-[0.25em] text-grayText">Оборудование</p>
          <p className="mt-2 text-dark">Реестр, статусы, ППР</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4 text-sm text-dark">
          <p className="text-xs uppercase tracking-[0.25em] text-grayText">Документация</p>
          <p className="mt-2 text-dark">Инструкции, регламенты, чек-листы</p>
        </div>
      </div>
    </div>
  )
}

export default UnitLandingPage
