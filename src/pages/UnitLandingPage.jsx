import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createScheduleService } from '../services/scheduleService'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-primary/15 to-background' },
  chem: { name: 'Химический цех', color: 'from-accent/15 to-background' },
  electro: { name: 'Электроцех', color: 'from-eco/15 to-background' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-primary/10 to-background' },
  fuel: { name: 'Цех топливоподачи', color: 'from-accent/10 to-background' },
}

function UnitLandingPage() {
  const { unit } = useParams()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const data = units[unit]
  const [shiftSummary, setShiftSummary] = useState({
    loading: false,
    error: '',
    shiftCode: '—',
    shiftType: 'day',
    shiftDate: '',
    chief: '',
    boiler: [],
    turbine: [],
  })

  const addDaysIso = (dateStr, days) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const getShiftCodeByDate = (dateStr, shiftType) => {
    const d = new Date(dateStr)
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
      const currentDate = now.toISOString().slice(0, 10)
      const currentType = now.getHours() >= 20 || now.getHours() < 8 ? 'night' : 'day'
      const shiftDate = currentType === 'night' && now.getHours() < 8 ? addDaysIso(currentDate, -1) : currentDate
      const nextDate = addDaysIso(shiftDate, 1)
      setShiftSummary((prev) => ({ ...prev, loading: true, error: '' }))
      const { data: rows, error } = await scheduleService.fetchRange({
        from: shiftDate,
        to: currentType === 'night' ? nextDate : shiftDate,
        unit,
      })
      if (error) {
        setShiftSummary((prev) => ({ ...prev, loading: false, error: error.message }))
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
        })
      })

      const activeEmployees = Array.from(employees.values()).filter((emp) => {
        if (currentType === 'day') {
          const entries = byEmpDay.get(`${emp.id}|${shiftDate}`) || []
          return entries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 12)
        }
        const dayEntries = byEmpDay.get(`${emp.id}|${shiftDate}`) || []
        const nextEntries = byEmpDay.get(`${emp.id}|${nextDate}`) || []
        const has3 = dayEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 3)
        const has9 = nextEntries.some((e) => Math.round(Number(e?.planned_hours || 0)) === 9)
        return has3 && has9
      })

      const boiler = activeEmployees.filter((e) => String(e.division || e.position).toLowerCase().includes('котел'))
      const turbine = activeEmployees.filter((e) => String(e.division || e.position).toLowerCase().includes('турбин'))
      const chief = activeEmployees.find((e) => String(e.position).toLowerCase().includes('начальник смены'))?.name || ''

      setShiftSummary({
        loading: false,
        error: '',
        shiftCode: getShiftCodeByDate(shiftDate, currentType),
        shiftType: currentType,
        shiftDate,
        chief,
        boiler: boiler.map((e) => e.name),
        turbine: turbine.map((e) => e.name),
      })
    }
    void load()
  }, [scheduleService, unit])

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
        <p className="text-xs uppercase tracking-[0.3em] text-grayText">Подразделение</p>
        <h1 className="mt-3 text-3xl font-semibold text-dark">{data.name}</h1>
        <p className="mt-2 text-sm text-dark">
          Выберите секцию: персонал, оборудование или документация. Можно перейти сразу по кнопкам ниже.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => navigate(`/${unit}/personnel`)}
            className="rounded-full bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-hover"
          >
            Персонал
          </button>
          <button
            onClick={() => navigate(`/${unit}/equipment`)}
            className="rounded-full border border-border px-4 py-2 text-dark transition hover:border-accent/70 hover:text-dark"
          >
            Оборудование
          </button>
          <button
            onClick={() => navigate(`/${unit}/docs`)}
            className="rounded-full border border-border px-4 py-2 text-dark transition hover:border-accent/70 hover:text-dark"
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
                  <p className="text-xs text-dark">{shiftSummary.loading ? 'Загрузка...' : shiftSummary.boiler.join(', ') || '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-grayText">Турбинное</p>
                  <p className="text-xs text-dark">{shiftSummary.loading ? 'Загрузка...' : shiftSummary.turbine.join(', ') || '—'}</p>
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
