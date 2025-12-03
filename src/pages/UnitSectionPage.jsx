import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { acknowledgeEntry, createEntry, fetchEntries, fetchJournalRead, markJournalRead } from '../api/entries'
import { createOverride, createScheduleEntry, fetchEmployeesByUnit, fetchOverridesRange, fetchScheduleRange, fetchShiftTemplates } from '../api/schedule'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-orange-500/20 to-slate-900' },
  chem: { name: 'Химический цех', color: 'from-cyan-500/20 to-slate-900' },
  electro: { name: 'Электроцех', color: 'from-emerald-500/20 to-slate-900' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-sky-500/20 to-slate-900' },
  fuel: { name: 'Цех топливоподачи', color: 'from-amber-500/20 to-slate-900' },
}

const sections = {
  personnel: 'Персонал',
  equipment: 'Оборудование',
  docs: 'Документация',
}

function UnitSectionPage() {
  const { unit, section } = useParams()
  const unitData = units[unit]
  const sectionLabel = sections[section]
  const isKtc = unit === 'ktc'
  const supabase = useSupabase()
  const { user } = useAuth()
  const profile = useProfile()
  const journalCode = 'ktc-docs'
  const journalName = 'Журнал КТЦ (документы)'
  const [entries, setEntries] = useState([])
  const [journalId, setJournalId] = useState(null)
  const [lastSeenAt, setLastSeenAt] = useState(null)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [entriesError, setEntriesError] = useState('')
  const [newEntry, setNewEntry] = useState({ type: 'admin', title: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState(['admin', 'turbine', 'boiler', 'daily'])
  const [ackLoadingId, setAckLoadingId] = useState(null)
  const [markAllLoading, setMarkAllLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [scheduleRows, setScheduleRows] = useState([])
  const [overrideRows, setOverrideRows] = useState([])
  const [scheduleError, setScheduleError] = useState('')
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [shiftTemplates, setShiftTemplates] = useState([])
  const [staff, setStaff] = useState([])
  const [staffError, setStaffError] = useState('')
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [positionFilter, setPositionFilter] = useState([])
  const [divisionFilter, setDivisionFilter] = useState([]) // departament_name: Турбинное/Котельное
  const [positionTypeFilter, setPositionTypeFilter] = useState(['admin', 'operational']) // массив типов
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [collapsedPositions, setCollapsedPositions] = useState([])

  const resetFilters = () => {
    setPositionTypeFilter(['admin', 'operational'])
    setDivisionFilter([])
    setPositionFilter([])
  }
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [selectedOverrideKind, setSelectedOverrideKind] = useState('vacation')

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )
  const formatDateTime = useCallback((value) => (value ? dateFormatter.format(new Date(value)) : ''), [dateFormatter])

  const authorLabel = useMemo(() => {
    const emp = profile?.employee
    const fio = emp ? [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ') : ''
    const position = emp?.positions?.name || ''
    if (fio && position) return `${fio} · ${position}`
    if (fio) return fio
    return user?.email || '—'
  }, [profile?.employee, user?.email])

  const bg = unitData?.color || 'from-slate-800 to-slate-900'

  const subtitle = useMemo(() => {
    if (!unitData || !sectionLabel) return 'Раздел не найден'
    if (section === 'personnel') return 'Состав смены, контакты, роли'
    if (section === 'equipment') return 'Реестр оборудования, статус и ППР'
    if (section === 'docs') return 'Инструкции, регламенты, чек-листы'
    return ''
  }, [unitData, sectionLabel, section])

  const filteredList = useMemo(() => {
    const list = entries.filter((e) => selectedTypes.includes(e.type))
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [entries, selectedTypes])

  const newCount = useMemo(() => {
    if (!entries?.length) return 0
    return entries.filter((e) => {
      const isNewer = lastSeenAt ? new Date(e.created_at) > new Date(lastSeenAt) : true
      return !e.acknowledged && isNewer
    }).length
  }, [entries, lastSeenAt])

  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })

  const monthDates = useMemo(() => {
    const result = []
    const start = new Date(monthStart)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(0) // последний день месяца
    const days = end.getDate()
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      result.push(d.toISOString().slice(0, 10))
    }
    return result
  }, [monthStart])

  const monthLabel = useMemo(() => {
    const d = new Date(monthStart)
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }, [monthStart])

  const shiftTemplateMap = useMemo(() => Object.fromEntries((shiftTemplates || []).map((t) => [t.id, t])), [shiftTemplates])

  const staffWithLabels = useMemo(() => {
    const src = staff.length ? staff : []
    return src
      .map((emp) => {
        const label = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ') || `ID ${emp.id}`
        const position = emp.positions?.name || ''
        const division = emp.positions?.devision_name || ''
        const department = emp.positions?.departament_name || ''
        const positionType = emp.positions?.type || ''
        return { id: emp.id, label, position, division, department, positionType }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [staff])

  const employeesFromSchedule = useMemo(() => {
    const map = new Map()
    staffWithLabels.forEach((e) => map.set(e.id, e))
    if (!map.size) {
      scheduleRows.forEach((row) => {
        const label = row.employees ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ') : `ID ${row.employee_id}`
        map.set(row.employee_id, {
          id: row.employee_id,
          label,
          position: row.employees?.positions?.name || '',
          division: row.employees?.positions?.devision_name || '',
          department: row.employees?.positions?.departament_name || '',
          positionType: row.employees?.positions?.type || '',
        })
      })
    }
    overrideRows.forEach((row) => {
      if (!map.has(row.employee_id)) {
        const label = row.employees ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ') : `ID ${row.employee_id}`
        map.set(row.employee_id, {
          id: row.employee_id,
          label,
          position: row.employees?.positions?.name || '',
          division: row.employees?.positions?.devision_name || '',
          department: row.employees?.positions?.departament_name || '',
          positionType: row.employees?.positions?.type || '',
        })
      }
    })
    let list = Array.from(map.values())
    if (divisionFilter && divisionFilter.length) {
      const set = new Set(divisionFilter.map((d) => d.toLowerCase()))
      list = list.filter((e) => set.has((e.department || '').toLowerCase()))
    }
    if (positionTypeFilter.length) {
      list = list.filter((e) => {
        const typeLc = (e.positionType || '').toLowerCase()
        const isAdmin = typeLc.includes('административ')
        const isOper = typeLc.includes('оператив')
        const allowAdmin = positionTypeFilter.includes('admin')
        const allowOper = positionTypeFilter.includes('operational')
        if (allowAdmin && isAdmin) return true
        if (allowOper && isOper) return true
        // если тип не указан в БД, оставляем, только если обе группы выбраны
        if (!typeLc && allowAdmin && allowOper) return true
        return false
      })
    }
    if (positionFilter && positionFilter.length) {
      const set = new Set(positionFilter)
      list = list.filter((e) => set.has(e.position))
    }
    return list
  }, [staffWithLabels, scheduleRows, overrideRows, positionFilter, divisionFilter, positionTypeFilter])

  const scheduleMap = useMemo(() => {
    const m = new Map()
    scheduleRows.forEach((row) => {
      m.set(`${row.employee_id}-${row.date}`, row)
    })
    return m
  }, [scheduleRows])

  const overridesByKey = useMemo(() => {
    const m = new Map()
    overrideRows.forEach((o) => {
      const key = `${o.employee_id}-${o.date}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(o)
    })
    return m
  }, [overrideRows])

  const groupedByPosition = useMemo(() => {
    const map = new Map()
    employeesFromSchedule.forEach((emp) => {
      const key = emp.position || 'Без должности'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(emp)
    })
    return Array.from(map.entries())
      .map(([position, list]) => ({ position, list }))
      .sort((a, b) => a.position.localeCompare(b.position, 'ru'))
  }, [employeesFromSchedule])

  const positionOptions = useMemo(() => {
    const set = new Set()
    const addPos = (pos, type, dept) => {
      if (!pos) return
      // Фильтры по типу (могут быть несколько)
      const typeLc = (type || '').toLowerCase()
      const allowAdmin = positionTypeFilter.includes('admin')
      const allowOper = positionTypeFilter.includes('operational')
      const isAdmin = typeLc.includes('административ')
      const isOper = typeLc.includes('оператив')
      if (!((allowAdmin && isAdmin) || (allowOper && isOper) || (allowAdmin && allowOper))) return
      // Фильтры по отделению
      if (divisionFilter.length && dept && !divisionFilter.map((d) => d.toLowerCase()).includes((dept || '').toLowerCase())) return
      set.add(pos)
    }
    staffWithLabels.forEach((s) => addPos(s.position, s.positionType, s.department))
    scheduleRows.forEach((r) => addPos(r.employees?.positions?.name, r.employees?.positions?.type, r.employees?.positions?.departament_name))
    overrideRows.forEach((r) => addPos(r.employees?.positions?.name, r.employees?.positions?.type, r.employees?.positions?.departament_name))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [divisionFilter, overrideRows, positionTypeFilter, scheduleRows, staffWithLabels])

  const divisionOptions = useMemo(() => {
    const set = new Set()
    staffWithLabels.forEach((s) => s.department && set.add(s.department))
    scheduleRows.forEach((r) => r.employees?.positions?.departament_name && set.add(r.employees.positions.departament_name))
    overrideRows.forEach((r) => r.employees?.positions?.departament_name && set.add(r.employees.positions.departament_name))
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ru'))
  }, [overrideRows, scheduleRows, staffWithLabels])

  const loadEntries = useCallback(async () => {
    if (!isKtc || section !== 'docs' || !user) return
    setLoadingEntries(true)
    setEntriesError('')
    const { data, error, journalId: resolvedId } = await fetchEntries({
      supabase,
      journalCode,
      journalName,
      profileId: user.id,
    })
    if (error) {
      setEntriesError(error.message)
      setEntries([])
      setLoadingEntries(false)
      setRefreshing(false)
      return
    }
    setEntries(data || [])
    setJournalId(resolvedId || null)

    const { data: readData, error: readError } = await fetchJournalRead({
      supabase,
      journalId: resolvedId,
      profileId: user.id,
      journalCode,
      journalName,
    })
    if (!readError) {
      setLastSeenAt(readData?.last_seen_at || null)
    }
    setLoadingEntries(false)
    setRefreshing(false)
  }, [isKtc, journalCode, journalName, section, supabase, user])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const loadSchedule = useCallback(
    async (opts = {}) => {
      if (!unit || section !== 'personnel' || !user) return
      const { silent } = opts
      if (!silent) setLoadingSchedule(true)
      setScheduleError('')
      const from = monthDates[0]
      const to = monthDates[monthDates.length - 1]
      const { data, error } = await fetchScheduleRange({ supabase, from, to, unit })
      if (error) {
        setScheduleError(error.message)
        setScheduleRows([])
        setOverrideRows([])
        setLoadingSchedule(false)
        return
      }
      setScheduleRows(data || [])
      const { data: ovData, error: ovErr } = await fetchOverridesRange({ supabase, from, to, unit })
      if (ovErr) {
        setScheduleError(ovErr.message)
        setOverrideRows([])
        setLoadingSchedule(false)
        return
      }
      setOverrideRows(ovData || [])
      setLoadingSchedule(false)
    },
    [section, unit, supabase, user, monthDates],
  )

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  const loadStaff = useCallback(async () => {
    if (!unit || section !== 'personnel' || !user) return
    setLoadingStaff(true)
    setStaffError('')
    const { data, error } = await fetchEmployeesByUnit({ supabase, unit })
    if (error) {
      setStaffError(error.message)
      setLoadingStaff(false)
      return
    }
    const unitKey = unit.toLowerCase()
    const unitName = (units[unit]?.name || '').toLowerCase()
    const filtered = (data || []).filter((e) => {
      const div = (e.positions?.devision_name || '').toLowerCase()
      if (!unitKey) return true
      if (!div) return false
      return div === unitKey || (unitName && div === unitName)
    })
    setStaff(filtered)
    setLoadingStaff(false)
  }, [section, supabase, unit, user])

  const loadShiftTemplates = useCallback(async () => {
    const { data, error } = await fetchShiftTemplates({ supabase })
    if (!error) setShiftTemplates(data || [])
  }, [supabase])

  useEffect(() => {
    loadStaff()
  }, [loadStaff, monthStart])

  useEffect(() => {
    loadShiftTemplates()
  }, [loadShiftTemplates])

  const handleCreate = async () => {
    if (!newEntry.title.trim()) {
      setEntriesError('Введите заголовок')
      return
    }
    if (!user) {
      setEntriesError('Нужна авторизация')
      return
    }
    setSaving(true)
    setEntriesError('')
    const { data, error } = await createEntry({
      supabase,
      journalCode: 'ktc-docs',
      journalName,
      journalId,
      profileId: user.id,
      payload: {
        type: newEntry.type,
        title: newEntry.title,
        body: newEntry.body,
        unit: unit || null,
        created_by_employee_id: profile?.employee?.id || null,
        author_snapshot: authorLabel ? { label: authorLabel } : null,
      },
    })
    if (error) {
      setEntriesError(error.message)
    } else {
      if (data) setEntries((prev) => [data, ...prev])
      setNewEntry({ type: newEntry.type, title: '', body: '' })
      await loadEntries()
    }
    setSaving(false)
  }

  const handleAcknowledge = async (entryId) => {
    if (!user) return
    setAckLoadingId(entryId)
    const { error } = await acknowledgeEntry({ supabase, entryId, profileId: user.id })
    if (error) {
      setEntriesError(error.message)
    } else {
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                acknowledged: true,
                receipts: [...(item.receipts || []), { profile_id: user.id, acknowledged_at: new Date().toISOString() }],
              }
            : item,
        ),
      )
    }
    setAckLoadingId(null)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadEntries()
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    setMarkAllLoading(true)
    const { error } = await markJournalRead({
      supabase,
      journalId,
      journalCode,
      journalName,
      profileId: user.id,
    })
    if (error) {
      setEntriesError(error.message)
    } else {
      const nowIso = new Date().toISOString()
      setLastSeenAt(nowIso)
    }
    setMarkAllLoading(false)
  }

  const handleApplyShift = async (employeeId, date) => {
    if (!user || !employeeId || !date) return
    if (!selectedShiftId) return
    if (selectedShiftId === 'off') {
      const payload = {
        employee_id: Number(employeeId),
        date,
        start_time: null,
        end_time: null,
        planned_hours: 0,
        unit: unit,
        created_by: user.id,
        source: 'manual',
        note: 'Выходной',
      }
      await createScheduleEntry({ supabase, payload })
      loadSchedule({ silent: true })
      return
    }
    const tmpl = shiftTemplateMap[selectedShiftId]
    if (!tmpl) return
    const payload = {
      employee_id: Number(employeeId),
      date,
      start_time: tmpl.start_time,
      end_time: tmpl.end_time,
      planned_hours: tmpl.duration_hours,
      unit: unit,
      created_by: user.id,
      source: tmpl.code || 'template',
      template_id: tmpl.id,
    }
    await createScheduleEntry({ supabase, payload })
    loadSchedule({ silent: true })
  }

  const handleApplyOverride = async (employeeId, date) => {
    if (!user || !employeeId || !date) return
    const payload = {
      employee_id: Number(employeeId),
      date,
      kind: selectedOverrideKind || 'vacation',
      unit: unit,
      created_by: user.id,
    }
    await createOverride({ supabase, payload })
    loadSchedule({ silent: true })
  }

  if (!unitData || !sectionLabel) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Навигация</p>
        <p className="text-lg font-semibold text-white">Раздел не найден</p>
        <p className="text-xs text-slate-400">Выберите подразделение в меню слева.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${bg} p-8 shadow-xl shadow-sky-900/10`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
          {unitData.name} · {sectionLabel}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{sectionLabel}</h1>
        <p className="mt-2 text-sm text-slate-200">{subtitle}</p>
      </div>

      {isKtc && section === 'docs' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Журналы КТЦ</p>
                <h3 className="text-lg font-semibold text-white">Распоряжения и ведомости</h3>
                <p className="text-sm text-slate-300">Директивы, техтемы и суточные ведомости. Автор + ознакомления.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={loadingEntries || refreshing}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing || loadingEntries ? 'Обновляем...' : 'Обновить'}
                </button>
                <button
                  onClick={handleMarkAllRead}
                  disabled={markAllLoading}
                  className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markAllLoading ? 'Сохраняем...' : 'Все прочитано'}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Новых</p>
                <p className="text-lg font-semibold text-white">{newCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Всего записей</p>
                <p className="text-lg font-semibold text-white">{entries.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Последнее чтение</p>
                <p className="text-sm text-slate-200">{lastSeenAt ? formatDateTime(lastSeenAt) : '—'}</p>
              </div>
            </div>
            {entriesError && <p className="mt-3 rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">Ошибка: {entriesError}</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Новая запись</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">
                Тип
                <select
                  value={newEntry.type}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, type: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                >
                  <option value="admin">Административные (КТЦ)</option>
                  <option value="turbine">Тех. ТО</option>
                  <option value="boiler">Тех. КО</option>
                  <option value="daily">Суточная ведомость</option>
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Заголовок
                <input
                  value={newEntry.title}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, title: e.target.value }))}
                  type="text"
                  placeholder="Краткое распоряжение"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
              </label>
            </div>
              <label className="mt-2 block text-xs text-slate-300">
                Описание
                <textarea
                  value={newEntry.body}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, body: e.target.value }))}
                rows={3}
                placeholder="Детали распоряжения / действия"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Сохраняем...' : 'Создать'}
              </button>
              <button
                onClick={() => setNewEntry({ ...newEntry, title: '', body: '' })}
                disabled={saving}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Очистить
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-white">Распоряжения / ведомости</p>
              <span className="rounded-full border border-white/10 bg-sky-500/15 px-3 py-1 text-[11px] uppercase text-slate-100">
                {selectedTypes.join(', ') || 'нет источников'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { key: 'admin', label: 'Административные (КТЦ)' },
                { key: 'turbine', label: 'Тех. ТО' },
                { key: 'boiler', label: 'Тех. КО' },
                { key: 'daily', label: 'Суточная ведомость' },
              ].map((src) => (
                <button
                  key={src.key}
                  onClick={() => {
                    setSelectedTypes((prev) =>
                      prev.includes(src.key) ? prev.filter((t) => t !== src.key) : [...prev, src.key],
                    )
                  }}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selectedTypes.includes(src.key)
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-white/10 text-slate-100 hover:border-sky-400/60 hover:text-white'
                  }`}
                >
                  {src.label} ({entries.filter((e) => e.type === src.key).length || 0})
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {loadingEntries && <p className="text-xs text-slate-400">Обновляем список...</p>}
              {filteredList.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>#{item.id}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    Автор: {item.author_snapshot?.label || item.author_name || '—'} {item.unit ? `· ${item.unit}` : ''}
                    {item.type ? ` · ${item.type}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] uppercase text-sky-100">
                      {item.type}
                    </span>
                    {!item.acknowledged && (
                      <span className="inline-block rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase text-emerald-100">
                        Новое
                      </span>
                    )}
                  </div>
                  {item.body && <p className="text-xs text-slate-300">{item.body}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleAcknowledge(item.id)}
                      disabled={item.acknowledged || ackLoadingId === item.id}
                      className={`rounded-full px-3 py-1 text-[11px] transition ${
                        item.acknowledged
                          ? 'border border-white/10 text-slate-400'
                          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {item.acknowledged ? 'Ознакомлен' : ackLoadingId === item.id ? 'Сохраняем...' : 'Отметить ознакомление'}
                    </button>
                  </div>
                </div>
              ))}
              {!filteredList.length && !loadingEntries && <p className="text-xs text-slate-400">Нет записей</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'personnel' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">График смен</p>
                <h3 className="text-lg font-semibold text-white">Календарь по цеху</h3>
                <p className="text-sm text-slate-300">Сотрудники слева, даты в шапке. Клик по ячейке — проставить смену или отсутствие.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[10px] leading-none text-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5">
                  <span className="text-slate-400">Тип:</span>
                  {[
                    { key: 'admin', label: 'Админ' },
                    { key: 'operational', label: 'Оператив' },
                  ].map((t) => {
                    const active = positionTypeFilter.includes(t.key)
                    return (
                      <button
                        key={t.key}
                        onClick={() => {
                          setPositionTypeFilter((prev) =>
                            prev.includes(t.key) ? prev.filter((x) => x !== t.key) : [...prev, t.key],
                          )
                          setPositionFilter([])
                        }}
                        className={`rounded-full px-1.5 py-0.5 transition ${
                          active
                            ? 'bg-emerald-500 text-slate-950'
                            : 'border border-white/10 bg-slate-900 text-slate-100 hover:border-emerald-400/60'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5">
                  <span className="text-[10px] text-slate-400">Отделение:</span>
                  {divisionOptions.map((div) => {
                    const active = divisionFilter.includes(div)
                    return (
                      <button
                        key={div}
                        onClick={() => {
                          setDivisionFilter((prev) => (prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]))
                          setPositionFilter([])
                        }}
                        className={`rounded-full px-1.5 py-0.5 text-[10px] transition ${
                          active
                            ? 'bg-sky-500 text-slate-950'
                            : 'border border-white/10 bg-slate-900 text-slate-100 hover:border-sky-400/60'
                        }`}
                      >
                        {div}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5">
                  <span className="text-slate-400">Должности:</span>
                  <button
                    onClick={() => setPositionsOpen((p) => !p)}
                    className="h-6 rounded-full border border-white/10 bg-slate-900 px-2 text-[10px] text-white transition hover:border-emerald-400/60"
                  >
                    {positionFilter.length ? `Выбрано: ${positionFilter.length}` : 'Выбрать'}
                  </button>
                  {positionsOpen && (
                    <div className="absolute left-0 top-7 z-20 w-52 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[10px] text-slate-100 shadow-lg">
                      <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                        {positionOptions.map((pos) => {
                          const checked = positionFilter.includes(pos)
                          return (
                            <label key={pos} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPositionFilter((prev) => [...prev, pos])
                                  } else {
                                    setPositionFilter((prev) => prev.filter((p) => p !== pos))
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded border-white/20 bg-slate-900"
                              />
                              <span>{pos}</span>
                            </label>
                          )
                        })}
                        {!positionOptions.length && <span className="text-slate-500">Нет должностей</span>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            setPositionFilter([])
                            setPositionsOpen(false)
                          }}
                          className="flex-1 rounded-full border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] text-white transition hover:border-sky-400/60"
                        >
                          Очистить
                        </button>
                        <button
                          onClick={() => setPositionsOpen(false)}
                          className="flex-1 rounded-full border border-emerald-400/40 bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950 transition hover:bg-emerald-400"
                        >
                          Готово
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={resetFilters}
                  className="rounded-full border border-red-500 bg-red-600 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-red-500"
                >
                  Сброс
                </button>
              </div>
            </div>
            {loadingSchedule && <p className="mt-2 text-xs text-slate-400">Загрузка...</p>}
          </div>
            {scheduleError && <p className="mt-3 text-xs text-orange-300">Ошибка: {scheduleError}</p>}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-200">
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5">
                <button
                  onClick={() => {
                    const d = new Date(monthStart)
                    d.setMonth(d.getMonth() - 1)
                    d.setDate(1)
                    setMonthStart(d.toISOString().slice(0, 10))
                  }}
                  className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-0.5 transition hover:border-sky-400/60"
                >
                  ←
                </button>
                <button
                  onClick={() =>
                    setMonthStart(() => {
                      const d = new Date()
                      d.setDate(1)
                      return d.toISOString().slice(0, 10)
                    })
                  }
                  className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-0.5 transition hover:border-sky-400/60"
                >
                  {monthLabel}
                </button>
                <button
                  onClick={() => {
                    const d = new Date(monthStart)
                    d.setMonth(d.getMonth() + 1)
                    d.setDate(1)
                    setMonthStart(d.toISOString().slice(0, 10))
                  }}
                  className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-0.5 transition hover:border-sky-400/60"
                >
                  →
                </button>
              </div>
              <span className="text-[11px] text-slate-400">{monthDates.length} дней</span>
            </div>
            <div className="mt-2 relative max-h-[70vh] overflow-auto rounded-2xl border border-white/10">
              <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-xs text-slate-200">
                <thead className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur">
                  <tr>
                    <th className="sticky left-0 z-[35] w-44 bg-slate-900/95 px-3 py-1.5 text-left text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Сотрудник
                    </th>
                    {monthDates.map((d) => (
                      <th key={d} className="w-8 px-1 py-1.5 text-center text-[11px] uppercase tracking-[0.15em] text-slate-300">
                        {new Date(d).getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedByPosition.map((group) => {
                    const collapsed = collapsedPositions.includes(group.position)
                    return (
                      <Fragment key={group.position}>
                        <tr className="bg-slate-900/60 border-t border-white/10">
                          <td
                            colSpan={1 + monthDates.length}
                            className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300"
                          >
                            <button
                              onClick={() =>
                                setCollapsedPositions((prev) =>
                                  prev.includes(group.position)
                                    ? prev.filter((p) => p !== group.position)
                                    : [...prev, group.position],
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-slate-100 transition hover:border-sky-400/60"
                            >
                              <span className="text-base">{collapsed ? '▸' : '▾'}</span>
                              <span>{group.position}</span>
                              <span className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px]">
                                {group.list.length}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {!collapsed &&
                          group.list.map((emp) => (
                            <tr key={`${group.position}-${emp.id}`} className="border-t border-white/5">
                              <td className="sticky left-0 z-20 bg-slate-900/95 px-3 py-2 text-left text-sm font-semibold text-white">
                                {emp.label}
                              </td>
                              {monthDates.map((d) => {
                                const shift = scheduleMap.get(`${emp.id}-${d}`)
                                const overrides = overridesByKey.get(`${emp.id}-${d}`) || []
                                return (
                                  <td
                                    key={`${emp.id}-${d}`}
                                    onClick={() => setSelectedCell({ employeeId: emp.id, date: d })}
                                    className={`cursor-pointer px-1 py-1 align-top transition hover:bg-sky-500/10 ${
                                      selectedCell?.employeeId === emp.id && selectedCell?.date === d ? 'bg-sky-500/10' : ''
                                    }`}
                                  >
                                    <div className="rounded border border-white/10 bg-white/5 p-1 text-[10px] text-slate-300">
                                      {shift ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="truncate">
                                            {(shift.start_time || '').slice(0, 5)}–{(shift.end_time || '').slice(0, 5)}
                                          </span>
                                          <span className="text-[10px] text-slate-100">{shift.planned_hours ? `${Number(shift.planned_hours)} ч` : '—'}</span>
                                        </div>
                                      ) : (
                                        <div className="text-slate-500">—</div>
                                      )}
                                      {overrides.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {overrides.map((o) => {
                                            const kind = (o.kind || '').toLowerCase()
                                            const map = {
                                              vacation: 'Отп',
                                              sick: 'Бол',
                                              training: 'Уч',
                                              donor: 'Дон',
                                              comp_day_off: 'Отг',
                                              overtime: 'Пер',
                                              debt: 'Долг',
                                              holiday_work: 'Празд',
                                            }
                                            const label = map[kind] || kind || 'др.'
                                            return (
                                              <span
                                                key={o.id}
                                                className="rounded-full border border-orange-300/40 bg-orange-500/10 px-1.5 py-0.5 text-[9px] text-orange-100"
                                              >
                                                {label}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                      </Fragment>
                    )
                  })}
                  {employeesFromSchedule.length === 0 && (
                    <tr>
                      <td colSpan={1 + monthDates.length} className="px-3 py-4 text-center text-xs text-slate-400">
                        Нет данных за месяц. Добавьте смену по ID сотрудника, и она появится здесь.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {selectedCell && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Ячейка {selectedCell.employeeId} · {new Date(selectedCell.date).toLocaleDateString('ru-RU')}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Смена (шаблон)</p>
                    <select
                      value={selectedShiftId}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Выберите смену</option>
                      <option value="off">Выходной</option>
                      {shiftTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || t.code} · {t.start_time}–{t.end_time} · {t.duration_hours}ч
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleApplyShift(selectedCell.employeeId, selectedCell.date)}
                      className="mt-2 w-full rounded-full bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                    >
                      Применить смену
                    </button>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Отсутствие / исключение</p>
                    <select
                      value={selectedOverrideKind}
                      onChange={(e) => setSelectedOverrideKind(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    >
                      {['vacation', 'sick', 'training', 'donor', 'comp_day_off', 'overtime', 'debt'].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleApplyOverride(selectedCell.employeeId, selectedCell.date)}
                      className="mt-2 w-full rounded-full border border-white/10 px-3 py-2 text-sm text-slate-100 transition hover:border-orange-400/60 hover:text-white"
                    >
                      Применить исключение
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Список смен берётся из таблицы shift_templates. Выходной — planned_hours=0. Исключения падают в schedule_overrides.
                </p>
              </div>
            )}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200 shadow-lg">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Следующие шаги</p>
        <ul className="mt-3 space-y-2">
          {section === 'personnel' && (
            <>
              <li>• Подключить выборку состава смены по подразделению</li>
              <li>• Добавить контакты и роли (operator / supervisor)</li>
            </>
          )}
          {section === 'equipment' && (
            <>
              <li>• Фильтровать оборудование по подразделению</li>
              <li>• Показать статус ППР и ответственного</li>
            </>
          )}
          {section === 'docs' && (
            <>
              <li>• Вывести регламенты и инструкции для подразделения</li>
              <li>• Добавить быстрый поиск и фильтр по тегам</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

export default UnitSectionPage
