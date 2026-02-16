import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

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

const getWorkplaceSystemTargets = (workplace) => {
  const name = normalizeKey(workplace?.name)
  const code = normalizeKey(workplace?.code)
  const department = normalizeKey(workplace?.departament_id)
  const out = new Set()

  const isChief = name.includes('нс ктц') || code === 'нс_ктц'
  if (isChief) return { exactSystems: null, prefixes: ['ТА ', 'КА '] }

  const to = department.includes('турбин') || code.includes('_по_то') || code.includes('упт')
  const ko = department.includes('котель') || code.includes('_по_ко') || code.includes('упк')

  const numberMatch = `${workplace?.name || ''} ${workplace?.code || ''}`.match(/(\d+)/)
  const number = numberMatch ? String(numberMatch[1]) : ''

  if (to && number) out.add(`ТА ${number}`)
  if (ko && number) out.add(`КА ${number}`)

  if (out.size) return { exactSystems: [...out], prefixes: [] }
  if (to) return { exactSystems: null, prefixes: ['ТА '] }
  if (ko) return { exactSystems: null, prefixes: ['КА '] }

  return { exactSystems: null, prefixes: [] }
}

function WorkplacePage() {
  const { unit, workplaceId } = useParams()
  const supabase = useSupabase()
  const { user } = useAuth()
  const profile = useProfile()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const [workplace, setWorkplace] = useState(null)
  const [assignee, setAssignee] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [activeTab, setActiveTab] = useState('daily')
  const [dailyEntries, setDailyEntries] = useState([])
  const [dailyInput, setDailyInput] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [journalId, setJournalId] = useState(null)
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
        setAssignee({
          id: assignment.employee_id,
          fio: fio || `ID ${assignment.employee_id}`,
          position: assignment.position_name || assignment.employees?.positions?.name || '',
        })
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

  useEffect(() => {
    let active = true
    async function loadEquipment() {
      const { data, error: eqError } = await supabase
        .from('equipment')
        .select('id, name, status, equipment_system, type_id, equipment_types:equipment_types(name)')
        .order('name', { ascending: true })
        .limit(2000)
      if (!active || eqError) return
      const code = normalizeKey(workplace?.code)
      const name = normalizeKey(workplace?.name)
      const id = normalizeKey(workplaceId)
      const targets = getWorkplaceSystemTargets(workplace)
      const matches = (data || []).filter((item) => {
        const byCode = normalizeKey(item?.workplace_code)
        const byId = normalizeKey(item?.workplace_id)
        const bySystem = normalizeKey(item?.equipment_system)
        const rawSystem = String(item?.equipment_system || '')
        const full = normalizeKey(
          [
            item?.workplace,
            item?.control_point,
            item?.area,
            item?.zone,
            item?.section,
            item?.equipment_system,
            item?.description,
            item?.note,
          ]
            .filter(Boolean)
            .join(' '),
        )
        if (targets?.exactSystems?.length) {
          const exactMatch = targets.exactSystems.some((system) => normalizeKey(system) === bySystem)
          if (!exactMatch) return false
          return true
        }
        if (targets?.prefixes?.length) {
          const prefixMatch = targets.prefixes.some((prefix) => rawSystem.startsWith(prefix))
          if (prefixMatch) return true
        }
        if (code && (byCode === code || full.includes(code))) return true
        if (id && byId === id) return true
        if (name && full.includes(name)) return true
        return false
      })
      setEquipmentList(matches)
    }
    void loadEquipment()
    return () => {
      active = false
    }
  }, [supabase, workplace, workplaceId])

  useEffect(() => {
    let active = true
    async function resolveJournal() {
      const tryCodes = [`${unit}-docs`, 'ktc-docs', `${unit}-personnel`]
      for (const code of tryCodes) {
        const res = await supabase.from('journals').select('id, code').eq('code', code).maybeSingle()
        if (!active) return
        if (res.data?.id) {
          setJournalId(res.data.id)
          return
        }
      }
      setJournalId(null)
    }
    void resolveJournal()
    return () => {
      active = false
    }
  }, [supabase, unit])

  useEffect(() => {
    let active = true
    async function loadDailyEntries() {
      if (!journalId) {
        setDailyEntries([])
        return
      }
      const { data } = await supabase
        .from('entries')
        .select('id, title, body, created_at, tags, author_snapshot')
        .eq('journal_id', journalId)
        .eq('unit', unit)
        .eq('type', 'daily')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      const workplaceTag = `workplace:${String(workplaceId)}`
      const workplaceCodeTag = `workplace_code:${String(workplace?.code || '')}`
      const filtered = (data || []).filter((item) => {
        const tags = Array.isArray(item?.tags) ? item.tags : []
        if (tags.includes(workplaceTag)) return true
        if (workplace?.code && tags.includes(workplaceCodeTag)) return true
        return false
      })
      setDailyEntries(filtered)
    }
    void loadDailyEntries()
    return () => {
      active = false
    }
  }, [journalId, supabase, unit, workplaceId, workplace?.code])

  const handleAddDailyEntry = async () => {
    if (!journalId) {
      setError('Не найден журнал для суточной ведомости.')
      return
    }
    const text = String(dailyInput || '').trim()
    if (!text) return
    setSavingEntry(true)
    setError('')
    const payload = {
      journal_id: journalId,
      title: `Пост ${workplace?.name || workplace?.code || workplaceId}`,
      body: text,
      type: 'daily',
      unit,
      tags: [`workplace:${String(workplaceId)}`, `workplace_code:${String(workplace?.code || '')}`],
      created_by_profile_id: user?.id || null,
      created_by_employee_id: profile?.employee?.id || null,
      author_snapshot: profile?.employee
        ? {
            label: [profile.employee.last_name, profile.employee.first_name, profile.employee.middle_name]
              .filter(Boolean)
              .join(' '),
            position: profile.employee.positions?.name || '',
          }
        : null,
    }
    const { error: saveError } = await supabase.from('entries').insert(payload)
    setSavingEntry(false)
    if (saveError) {
      setError(saveError.message || 'Не удалось сохранить запись')
      return
    }
    setDailyInput('')
    const { data } = await supabase
      .from('entries')
      .select('id, title, body, created_at, tags, author_snapshot')
      .eq('journal_id', journalId)
      .eq('unit', unit)
      .eq('type', 'daily')
      .order('created_at', { ascending: false })
      .limit(100)
    const workplaceTag = `workplace:${String(workplaceId)}`
    const workplaceCodeTag = `workplace_code:${String(workplace?.code || '')}`
    const filtered = (data || []).filter((item) => {
      const tags = Array.isArray(item?.tags) ? item.tags : []
      if (tags.includes(workplaceTag)) return true
      if (workplace?.code && tags.includes(workplaceCodeTag)) return true
      return false
    })
    setDailyEntries(filtered)
  }

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
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
              {assignee ? (
                <>
                  <Link
                    to={`/people/${assignee.id}`}
                    className="inline-flex text-sm font-semibold text-emerald-100 underline decoration-emerald-300/50 underline-offset-2"
                  >
                    {assignee.fio}
                  </Link>
                  <p className="mt-1 text-xs text-slate-400">{assignee.position || 'Должность не указана'}</p>
                </>
              ) : (
                <p className="text-sm text-slate-300">Сотрудник не назначен</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('daily')}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeTab === 'daily'
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                Суточная ведомость
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeTab === 'docs'
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                Документация
              </button>
            </div>
            {activeTab === 'daily' ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Оборудование рабочего места</p>
                  <div className="mt-2 space-y-1">
                    {equipmentList.map((item, idx) => (
                      <div key={`${item.id || item.code || idx}`} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                        <p>{item.name || item.title || item.code || `Оборудование #${idx + 1}`}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.equipment_system || 'Без системы'} · {item?.equipment_types?.name || 'Тип не указан'} ·{' '}
                          {item.status || 'В работе'}
                        </p>
                      </div>
                    ))}
                    {!equipmentList.length && <p className="text-xs text-slate-500">Закрепленное оборудование пока не найдено.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Запись в ведомость</p>
                  <textarea
                    value={dailyInput}
                    onChange={(e) => setDailyInput(e.target.value)}
                    rows={3}
                    placeholder="Краткая запись за смену..."
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    onClick={() => void handleAddDailyEntry()}
                    disabled={savingEntry}
                    className="mt-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {savingEntry ? 'Сохраняем...' : 'Добавить запись'}
                  </button>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Лента суточной ведомости</p>
                  <div className="mt-2 space-y-2">
                    {dailyEntries.map((item) => (
                      <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-xs text-slate-100">{item.body || '—'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {item.author_snapshot?.label || 'Сотрудник'} ·{' '}
                          {item.created_at ? new Date(item.created_at).toLocaleString('ru-RU') : '—'}
                        </p>
                      </div>
                    ))}
                    {!dailyEntries.length && <p className="text-xs text-slate-500">Записей пока нет.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Документация рабочего места</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Link
                    to={`/${unit}/docs`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:border-sky-400/60"
                  >
                    Журналы
                  </Link>
                  <Link
                    to={`/${unit}/docs`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:border-sky-400/60"
                  >
                    Инструкции
                  </Link>
                  <Link
                    to={`/${unit}/docs`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:border-sky-400/60"
                  >
                    Схемы
                  </Link>
                </div>
                <p className="mt-2 text-xs text-slate-500">Далее сюда добавим разделы документов и рабочие журналы по посту.</p>
              </div>
            )}
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
