import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const workplaceDivision = (workplace) => {
  const raw = [
    workplace?.division_name,
    workplace?.devision_name,
    workplace?.division,
    workplace?.department_name,
    workplace?.departament_name,
    workplace?.department,
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

const isChiefPosition = (value) => {
  const normalized = normalizeText(value).replace(/\./g, ' ')
  return normalized.includes('начальник смены') || normalized.includes('нач смены') || (normalized.includes('начальник') && normalized.includes('смен'))
}

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
    shiftCode: '—',
    shiftType: 'day',
    shiftDate: '',
    chief: '',
    boilerRows: [],
    turbineRows: [],
  })

  const getShiftCodeByDate = (dateStr, shiftType) => {
    const d = parseIsoLocalDate(dateStr)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const dayNumber = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - yearStart.getTime()) / 86400000)
    const index = ((dayNumber % 4) + 4) % 4
    const codes = ['А', 'Б', 'В', 'Г']
    return codes[shiftType === 'night' ? (index + 1) % 4 : index] || '—'
  }

  useEffect(() => {
    if (unit !== 'ktc') return
    const load = async () => {
      const now = new Date()
      const currentDate = toIsoLocalDate(now)
      const currentType = now.getHours() >= 20 || now.getHours() < 8 ? 'night' : 'day'
      const shiftDate = currentType === 'night' && now.getHours() < 8 ? addDaysLocalIso(currentDate, -1) : currentDate
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
        })
      })
      const activeEmployees = Array.from(employees.values()).filter((emp) => {
        const dayEntries = byEmpDay.get(`${emp.id}|${shiftDate}`) || []
        const nextEntries = byEmpDay.get(`${emp.id}|${nextDate}`) || []
        const dayHours = dayEntries.reduce((sum, e) => sum + Number(e?.planned_hours || 0), 0)
        const nextHours = nextEntries.reduce((sum, e) => sum + Number(e?.planned_hours || 0), 0)
        if (currentType === 'day') {
          return dayHours > 0
        }
        const has3 = dayEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 3)
        const has9 = nextEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 9)
        return has3 && has9 ? true : dayHours + nextHours > 0
      })

      const workplaces = workplacesRes.data || []
      const byWpId = new Map(workplaces.map((wp) => [String(wp.id), wp]))
      const byWpCode = new Map(
        workplaces
          .filter((wp) => wp.code)
          .map((wp) => [normalizeText(wp.code), wp]),
      )
      const baseRows = workplaces
        .map((wp) => ({
          workplaceId: String(wp.id),
          workplaceName: String(wp.name || wp.code || `Пост ${wp.id}`),
          divisionKey: workplaceDivision(wp),
          isReserve: isReserveWorkplace(wp),
          employeeName: '',
        }))
        .filter((row) => (row.divisionKey === 'boiler' || row.divisionKey === 'turbine') && !row.isReserve)

      const sessionRes = await handoverService.fetchSession({ unit, shiftDate, shiftType: currentType })
      const sessionId = sessionRes?.data?.id || null
      let assignments = []
      if (sessionId) {
        const assignmentsRes = await handoverService.fetchAssignments({ sessionId })
        if (!assignmentsRes.error) assignments = assignmentsRes.data || []
      }

      const assignmentNameByWorkplace = new Map()
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
          const wpId = String(wp.id)
          if (assignmentNameByWorkplace.has(wpId)) return
          if (fullNameKey && occupiedNames.has(fullNameKey)) return
          assignmentNameByWorkplace.set(wpId, fullName)
          occupiedEmployees.add(empId)
          if (fullNameKey) occupiedNames.add(fullNameKey)
        })

      const rowsByWorkplace = baseRows.map((row) => ({
        ...row,
        employeeName: assignmentNameByWorkplace.get(row.workplaceId) || '',
      }))

      const assignDivisionFallback = (divisionKey, includeOthers = false) => {
        const places = rowsByWorkplace.filter((row) => row.divisionKey === divisionKey)
        const candidates = activeEmployees.filter((emp) => {
          const empDivision = employeeDivision(emp)
          return includeOthers ? empDivision !== 'boiler' && empDivision !== 'turbine' : empDivision === divisionKey
        })
        let idx = 0
        places.forEach((row) => {
          if (row.employeeName) return
          while (idx < candidates.length) {
            const candidate = candidates[idx]
            const candidateNameKey = normalizeText(candidate?.name)
            if (!occupiedEmployees.has(String(candidate.id)) && (!candidateNameKey || !occupiedNames.has(candidateNameKey))) break
            idx += 1
          }
          if (idx >= candidates.length) return
          row.employeeName = candidates[idx].name
          occupiedEmployees.add(String(candidates[idx].id))
          const candidateNameKey = normalizeText(candidates[idx].name)
          if (candidateNameKey) occupiedNames.add(candidateNameKey)
          idx += 1
        })
      }
      assignDivisionFallback('boiler')
      assignDivisionFallback('turbine')
      assignDivisionFallback('boiler', true)
      assignDivisionFallback('turbine', true)

      const chiefFromAssignments =
        (assignments || [])
          .filter((a) => a?.is_present !== false)
          .find((a) => isChiefPosition(a.position_name || a.employees?.positions?.name))?.employees || null

      const chief = chiefFromAssignments
        ? [chiefFromAssignments.last_name, chiefFromAssignments.first_name, chiefFromAssignments.middle_name].filter(Boolean).join(' ')
        : activeEmployees.find((e) => isChiefPosition(e.position))?.name || ''

      const boilerRows = rowsByWorkplace.filter((row) => row.divisionKey === 'boiler')
      const turbineRows = rowsByWorkplace.filter((row) => row.divisionKey === 'turbine')

      setShiftSummary({
        loading: false,
        error: '',
        shiftCode: getShiftCodeByDate(shiftDate, currentType),
        shiftType: currentType,
        shiftDate,
        chief,
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
              <p className="text-xs text-grayText">{shiftSummary.shiftDate || '—'} · Начальник: {shiftSummary.chief || 'не назначен'}</p>
              <div className="mt-2 grid gap-2">
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-grayText">Котельное</p>
                  {shiftSummary.loading ? (
                    <p className="text-xs text-dark">Загрузка...</p>
                  ) : (
                    <div className="space-y-1 text-xs text-dark">
                      {(shiftSummary.boilerRows || []).map((row) => (
                        <div key={row.workplaceId} className="flex items-start justify-between gap-2 rounded-md border border-border/70 bg-white/40 px-2 py-1">
                          <span className="text-grayText">{row.workplaceName}</span>
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
                          <span className="text-grayText">{row.workplaceName}</span>
                          <span className="text-right">{row.employeeName || '—'}</span>
                        </div>
                      ))}
                      {!shiftSummary.turbineRows?.length && <p>—</p>}
                    </div>
                  )}
                </div>
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
