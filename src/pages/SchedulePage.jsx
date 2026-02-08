/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { createOverride, createScheduleEntry, fetchOverridesRange, fetchScheduleRange } from '../api/schedule'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from '../hooks/useAuth'

const units = [
  { key: '', title: 'Все подразделения' },
  { key: 'ktc', title: 'Котлотурбинный цех' },
  { key: 'chem', title: 'Химический цех' },
  { key: 'electro', title: 'Электроцех' },
  { key: 'sai', title: 'Цех автоматики и измерений' },
  { key: 'fuel', title: 'Цех топливоподачи' },
]

const overrideKinds = [
  { key: 'vacation', label: 'Отпуск' },
  { key: 'sick', label: 'Больничный' },
  { key: 'training', label: 'Учёба / тренировка' },
  { key: 'donor', label: 'Донорский день' },
  { key: 'comp_day_off', label: 'Отгул' },
  { key: 'overtime', label: 'Переработка' },
  { key: 'debt', label: 'Долг по времени' },
  { key: 'holiday_work', label: 'Работа в праздник' },
]

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function employeeLabel(emp) {
  if (!emp) return 'Сотрудник'
  return [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ') || `ID ${emp.id}`
}

function SchedulePage() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const weekAhead = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  }, [])

  const [range, setRange] = useState({ from: today, to: weekAhead })
  const [unit, setUnit] = useState('')
  const [schedule, setSchedule] = useState([])
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [form, setForm] = useState({
    employee_id: '',
    date: today,
    start_time: '09:00',
    end_time: '18:00',
    planned_hours: '8',
    unit: '',
    note: '',
  })
  const [overrideForm, setOverrideForm] = useState({
    employee_id: '',
    date: today,
    kind: 'vacation',
    hours_delta: '',
    comment: '',
    unit: '',
  })

  useEffect(() => {
    // если выбран юнит в фильтре и в формах пусто — подставляем его
    setForm((prev) => (prev.unit ? prev : { ...prev, unit: unit || '' }))
    setOverrideForm((prev) => (prev.unit ? prev : { ...prev, unit: unit || '' }))
  }, [unit])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const row of schedule) {
      if (!map.has(row.date)) map.set(row.date, [])
      map.get(row.date).push(row)
    }
    return Array.from(map.entries())
      .map(([date, list]) => ({ date, list }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [schedule])

  const overridesByDate = useMemo(() => {
    const map = new Map()
    for (const row of overrides) {
      if (!map.has(row.date)) map.set(row.date, [])
      map.get(row.date).push(row)
    }
    return map
  }, [overrides])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const { data: schedData, error: schedErr } = await fetchScheduleRange({ supabase, from: range.from, to: range.to, unit })
      if (schedErr) {
        setError(schedErr.message)
        setLoading(false)
        return
      }
      setSchedule(schedData || [])
      const { data: ovData, error: ovErr } = await fetchOverridesRange({ supabase, from: range.from, to: range.to, unit })
      if (ovErr) {
        setError(ovErr.message)
        setLoading(false)
        return
      }
      setOverrides(ovData || [])
      setLoading(false)
    }
    load()
  }, [range.from, range.to, supabase, unit])

  const handleSaveSchedule = async () => {
    if (!user) return
    if (!form.employee_id || !form.date) {
      setError('Укажите сотрудника и дату')
      return
    }
    if (!(form.unit || unit)) {
      setError('Укажите подразделение (unit)')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      employee_id: Number(form.employee_id),
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      planned_hours: form.planned_hours ? Number(form.planned_hours) : null,
      unit: form.unit || unit,
      note: form.note || null,
      created_by: user.id,
    }
    const { error: saveErr } = await createScheduleEntry({ supabase, payload })
    if (saveErr) {
      setError(saveErr.message)
    } else {
      const { data: schedData } = await fetchScheduleRange({ supabase, from: range.from, to: range.to, unit })
      setSchedule(schedData || [])
    }
    setSaving(false)
  }

  const handleSaveOverride = async () => {
    if (!user) return
    if (!overrideForm.employee_id || !overrideForm.date) {
      setError('Укажите сотрудника и дату (override)')
      return
    }
    if (!(overrideForm.unit || unit)) {
      setError('Укажите подразделение (override)')
      return
    }
    setSavingOverride(true)
    setError('')
    const payload = {
      employee_id: Number(overrideForm.employee_id),
      date: overrideForm.date,
      kind: overrideForm.kind,
      hours_delta: overrideForm.hours_delta ? Number(overrideForm.hours_delta) : null,
      comment: overrideForm.comment || null,
      unit: overrideForm.unit || unit,
      created_by: user.id,
    }
    const { error: saveErr } = await createOverride({ supabase, payload })
    if (saveErr) {
      setError(saveErr.message)
    } else {
      const { data: ovData } = await fetchOverridesRange({ supabase, from: range.from, to: range.to, unit })
      setOverrides(ovData || [])
    }
    setSavingOverride(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-lg sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">График смен</p>
            <h1 className="text-2xl font-semibold text-dark">Планирование и исключения</h1>
            <p className="text-sm text-grayText">Диапазон дат, смены, отпуска/больничные/донорские.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-dark sm:justify-end">
            <label className="flex items-center gap-1">
              <span>с</span>
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-dark"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>по</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-dark"
              />
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-dark"
            >
              {units.map((u) => (
                <option key={u.key || 'all'} value={u.key}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-orange-300">Ошибка: {error}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-4 text-sm text-dark">
            <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Добавить смену</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-grayText">
                ID сотрудника
                <input
                  value={form.employee_id}
                  onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                  placeholder="123"
                />
              </label>
              <label className="text-xs text-grayText">
                Дата
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                />
              </label>
              <label className="text-xs text-grayText">
                Начало
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                />
              </label>
              <label className="text-xs text-grayText">
                Конец
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                />
              </label>
              <label className="text-xs text-grayText">
                Часы (план)
                <input
                  type="number"
                  step="0.5"
                  value={form.planned_hours}
                  onChange={(e) => setForm((p) => ({ ...p, planned_hours: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                />
              </label>
              <label className="text-xs text-grayText">
                Юнит/цех
                <input
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                  placeholder="ktc / chem / ..."
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-grayText">
              Комментарий
              <input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark"
                placeholder="смена, пост, примечание"
              />
            </label>
            <button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Сохраняем...' : 'Сохранить смену'}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 text-sm text-dark">
            <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Исключение / отсутствие</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-grayText">
                ID сотрудника
                <input
                  value={overrideForm.employee_id}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, employee_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                  placeholder="123"
                />
              </label>
              <label className="text-xs text-grayText">
                Дата
                <input
                  type="date"
                  value={overrideForm.date}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                />
              </label>
              <label className="text-xs text-grayText">
                Тип
                <select
                  value={overrideForm.kind}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, kind: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                >
                  {overrideKinds.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-grayText">
                Δ часов (+/-)
                <input
                  type="number"
                  step="0.5"
                  value={overrideForm.hours_delta}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, hours_delta: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                  placeholder="например 8 или -8"
                />
              </label>
              <label className="text-xs text-grayText">
                Юнит/цех
                <input
                  value={overrideForm.unit}
                  onChange={(e) => setOverrideForm((p) => ({ ...p, unit: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-dark"
                  placeholder="ktc / chem / ..."
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-grayText">
              Комментарий
              <input
                value={overrideForm.comment}
                onChange={(e) => setOverrideForm((p) => ({ ...p, comment: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark"
                placeholder="отпуск, больничный, донорский..."
              />
            </label>
            <button
              onClick={handleSaveOverride}
              disabled={savingOverride}
              className="mt-3 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingOverride ? 'Сохраняем...' : 'Сохранить исключение'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 text-sm text-dark shadow-lg sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">Диапазон</p>
            <p className="text-lg font-semibold text-dark">
              {formatDate(range.from)} — {formatDate(range.to)} ({schedule.length} смен, {overrides.length} исключений)
            </p>
          </div>
          {loading && <span className="text-xs text-grayText">Загрузка...</span>}
        </div>
        <div className="mt-4 space-y-3">
          {grouped.map((day) => (
            <div key={day.date} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-col gap-1 text-xs text-grayText sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-dark">{formatDate(day.date)}</span>
                <span className="rounded-full border border-border bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  {day.list.length} смен
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {day.list.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grayText">
                      <span className="font-semibold text-dark">{employeeLabel(row.employees)}</span>
                      <span>
                        {row.start_time || '—'} — {row.end_time || '—'} · {row.planned_hours || '—'} ч
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-grayText">
                      {row.unit && <span className="rounded-full border border-border px-2 py-0.5">{row.unit}</span>}
                      {row.source && (
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-grayText">
                          {row.source}
                        </span>
                      )}
                      {row.note && <span className="text-grayText">{row.note}</span>}
                    </div>
                    {overridesByDate.has(row.date) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-orange-200">
                        {overridesByDate.get(row.date).filter((o) => o.employee_id === row.employee_id).map((o) => (
                          <span key={o.id} className="rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-0.5">
                            {o.kind} {o.hours_delta ? `(${o.hours_delta > 0 ? '+' : ''}${o.hours_delta} ч)` : ''} {o.comment || ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!grouped.length && !loading && <p className="text-xs text-grayText">Нет данных за выбранный период.</p>}
        </div>
      </div>
    </div>
  )
}

export default SchedulePage
