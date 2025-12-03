import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import PillButton from '../components/PillButton'
import Badge from '../components/Badge'
import { unitsMap, sectionsMap } from '../constants/units'
import { createEntriesService } from '../services/entriesService'
import { createScheduleService } from '../services/scheduleService'

function UnitSectionPage() {
  const { unit, section } = useParams()
  const unitData = unitsMap[unit]
  const sectionLabel = sectionsMap[section]
  const isKtc = unit === 'ktc'
  const supabase = useSupabase()
  const entriesService = useMemo(() => createEntriesService(supabase), [supabase])
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
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
  const [scheduleError, setScheduleError] = useState('')
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [menuCell, setMenuCell] = useState(null)
  const [selectionAnchor, setSelectionAnchor] = useState(null)
  const [shiftTemplates, setShiftTemplates] = useState([])
  const [staff, setStaff] = useState([])
  const [staffError, setStaffError] = useState('')
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [positionFilter, setPositionFilter] = useState([])
  const [divisionFilter, setDivisionFilter] = useState([]) // departament_name: Турбинное/Котельное
  const [positionTypeFilter, setPositionTypeFilter] = useState(['admin', 'operational']) // массив типов
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [collapsedPositions, setCollapsedPositions] = useState([])
  const [pinnedEmployees, setPinnedEmployees] = useState([])
  const [hiddenEmployees, setHiddenEmployees] = useState([])
  const [selectedCells, setSelectedCells] = useState([])
  const MAX_DAY_HOURS = 12

  const clampPositiveHours = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 0
    const num = Number(value)
    if (num <= 0) return num
    return Math.min(num, MAX_DAY_HOURS)
  }

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const resetFilters = () => {
    setPositionTypeFilter(['admin', 'operational'])
    setDivisionFilter([])
    setPositionFilter([])
    setPinnedEmployees([])
    setHiddenEmployees([])
  }
  const [selectedShiftId, setSelectedShiftId] = useState('')

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
  const customShiftOptions = useMemo(
    () => [
      { value: 'clear', label: 'Очистить ячейку', meta: 'нет смены', type: 'meta', hours: null, note: '' },
      { value: 'day8', label: 'День (8ч)', meta: '+8 ч', type: 'status', hours: 8, note: 'Дневная смена 8ч' },
      { value: 'day12', label: 'День (12ч)', meta: '+12 ч', type: 'status', hours: 12, note: 'Дневная смена 12ч' },
      { value: 'night12', label: 'Ночь (12ч)', meta: '+12 ч', type: 'status', hours: 12, note: 'Ночная смена 3+9' },
      { value: 'training', label: 'Техучёба', meta: '+4 ч', type: 'status', hours: 4, note: 'Техучёба' },
      { value: 'emergency', label: 'Противоаварийка', meta: '+4 ч', type: 'status', hours: 4, note: 'Противоаварийка' },
      { value: 'donor', label: 'Донорский', meta: '+8 ч', type: 'status', hours: 8, note: 'Донорский день' },
      { value: 'business_trip', label: 'Командировка', meta: '+8 ч', type: 'status', hours: 8, note: 'Командировка' },
      { value: 'maternity', label: 'Декрет/уход', meta: '0 ч', type: 'status', hours: 0, note: 'Декрет/уход' },
      { value: 'vacation', label: 'Отпуск', meta: 'снижает норму', type: 'status', hours: 0, note: 'Отпуск (норма ↓)' },
      { value: 'sick', label: 'Больничный', meta: 'снижает норму', type: 'status', hours: 0, note: 'Больничный (норма ↓)' },
      { value: 'comp_day_off', label: 'Отгул', meta: '-8 ч', type: 'status', hours: -8, note: 'Отгул' },
      { value: 'off', label: 'Выходной', meta: '0 ч', type: 'rest', hours: 0, note: 'Выходной' },
    ],
    [],
  )
  const customShiftMap = useMemo(() => Object.fromEntries(customShiftOptions.map((o) => [o.value, o])), [customShiftOptions])
  const shiftOptions = useMemo(() => {
    const templates = shiftTemplates.map((t) => ({
      value: t.id,
      label: t.name || t.code,
      meta: `${t.start_time}–${t.end_time} · ${t.duration_hours}ч`,
      type: 'work',
    }))
    return customShiftOptions.concat(templates)
  }, [customShiftOptions, shiftTemplates])

  const isNightSplitTemplate = (tmpl) => {
    if (!tmpl) return false
    if (!tmpl.start_time || !tmpl.end_time) return false
    // Ночная смена: начало вечером, окончание утром (переворот через полночь)
    return tmpl.start_time > tmpl.end_time
  }

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
        const label = row.employees
          ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
          : `ID ${row.employee_id}`
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
    const pinnedSet = new Set(pinnedEmployees)
    const hiddenSet = new Set(hiddenEmployees)
    if (pinnedSet.size) {
      list = list.filter((e) => pinnedSet.has(e.id))
    } else if (hiddenSet.size) {
      list = list.filter((e) => !hiddenSet.has(e.id))
    }
    return list
  }, [staffWithLabels, scheduleRows, positionFilter, divisionFilter, positionTypeFilter, pinnedEmployees, hiddenEmployees])

  const scheduleMap = useMemo(() => {
    const m = new Map()
    scheduleRows.forEach((row) => {
      m.set(`${row.employee_id}-${row.date}`, row)
    })
    return m
  }, [scheduleRows])

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

  const visibleRows = useMemo(() => {
    const list = []
    groupedByPosition.forEach((group) => {
      if (collapsedPositions.includes(group.position)) return
      group.list.forEach((emp) => list.push(emp))
    })
    return list
  }, [collapsedPositions, groupedByPosition])

  const employeeIndexMap = useMemo(() => new Map(visibleRows.map((e, idx) => [e.id, idx])), [visibleRows])

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
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [divisionFilter, positionTypeFilter, scheduleRows, staffWithLabels])

  const divisionOptions = useMemo(() => {
    const set = new Set()
    staffWithLabels.forEach((s) => s.department && set.add(s.department))
    scheduleRows.forEach((r) => r.employees?.positions?.departament_name && set.add(r.employees.positions.departament_name))
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ru'))
  }, [scheduleRows, staffWithLabels])

  const loadEntries = useCallback(async () => {
    if (!isKtc || section !== 'docs' || !user) return
    setLoadingEntries(true)
    setEntriesError('')
    const { data, error, journalId: resolvedId } = await entriesService.list({
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

    const { data: readData, error: readError } = await entriesService.lastRead({
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
  }, [entriesService, isKtc, journalCode, journalName, section, user])

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
      const { data, error } = await scheduleService.fetchRange({ from, to, unit })
      if (error) {
        setScheduleError(error.message)
        setScheduleRows([])
        setLoadingSchedule(false)
        return
      }
      setScheduleRows(data || [])
      setLoadingSchedule(false)
    },
    [section, unit, user, monthDates, scheduleService],
  )

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  const loadStaff = useCallback(async () => {
    if (!unit || section !== 'personnel' || !user) return
    setLoadingStaff(true)
    setStaffError('')
    const { data, error } = await scheduleService.fetchEmployeesByUnit(unit)
    if (error) {
      setStaffError(error.message)
      setLoadingStaff(false)
      return
    }
    setStaff(data || [])
    setSelectedCells([])
    setSelectionAnchor(null)
    setLoadingStaff(false)
  }, [scheduleService, section, unit, user])

  const loadShiftTemplates = useCallback(async () => {
    const { data, error } = await scheduleService.fetchShiftTemplates()
    if (!error) setShiftTemplates(data || [])
  }, [scheduleService])

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
    const { data, error } = await entriesService.create({
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
    const { error } = await entriesService.acknowledge({ entryId, profileId: user.id })
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
    const { error } = await entriesService.markRead({
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

  const handleCellClick = useCallback(
    (employeeId, date, event) => {
      const isMeta = event?.metaKey || event?.ctrlKey
      const isShift = event?.shiftKey
      const anchor = selectionAnchor || { employeeId, date }

      if (isShift && anchor) {
        const anchorRow = employeeIndexMap.get(anchor.employeeId)
        const targetRow = employeeIndexMap.get(employeeId)
        const anchorCol = monthDates.indexOf(anchor.date)
        const targetCol = monthDates.indexOf(date)

        if (
          anchorRow !== undefined &&
          targetRow !== undefined &&
          anchorCol !== -1 &&
          targetCol !== -1
        ) {
          const rowSlice = visibleRows.slice(Math.min(anchorRow, targetRow), Math.max(anchorRow, targetRow) + 1)
          const colSlice = monthDates.slice(Math.min(anchorCol, targetCol), Math.max(anchorCol, targetCol) + 1)
          const rect = []
          rowSlice.forEach((r) => colSlice.forEach((c) => rect.push({ employeeId: r.id, date: c })))
          setSelectedCells(rect)
        }
        setSelectedCell({ employeeId, date })
        setSelectionAnchor(anchor)
        setMenuCell({ employeeId, date })
        return
      }

      if (isMeta) {
        setSelectionAnchor(selectionAnchor || { employeeId, date })
        setSelectedCell({ employeeId, date })
        setMenuCell({ employeeId, date })
        setSelectedCells((prev) => {
          const exists = prev.some((c) => c.employeeId === employeeId && c.date === date)
          if (exists) return prev.filter((c) => !(c.employeeId === employeeId && c.date === date))
          return [...prev, { employeeId, date }]
        })
        return
      }

      setSelectionAnchor({ employeeId, date })
      setSelectedCell({ employeeId, date })
      setSelectedCells([{ employeeId, date }])
      setMenuCell({ employeeId, date })
    },
    [employeeIndexMap, monthDates, selectionAnchor, visibleRows],
  )

  const handleApplyShift = async (employeeId, date, shiftIdArg) => {
    if (!user || !employeeId || !date) return
    const shiftId = shiftIdArg ?? selectedShiftId
    if (!shiftId) return
    if (shiftId === 'clear') {
      await scheduleService.deleteEntry({ employeeId: Number(employeeId), date })
      loadSchedule({ silent: true })
      return
    }
    if (shiftId === 'off') {
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
      await scheduleService.createEntry(payload)
      loadSchedule({ silent: true })
      return
    }

    const custom = customShiftMap[shiftId]
    if (custom) {
      const payload = {
        employee_id: Number(employeeId),
        date,
        start_time: null,
        end_time: null,
        planned_hours: clampPositiveHours(custom.hours ?? 0),
        unit: unit,
        created_by: user.id,
        source: 'status',
        note: custom.note || custom.label || 'Статус',
      }
      await scheduleService.createEntry(payload)
      loadSchedule({ silent: true })
      return
    }

    const tmpl = shiftTemplateMap[shiftId]
    if (!tmpl) return
    if (isNightSplitTemplate(tmpl)) {
      const dayOneHours = clampPositiveHours(3)
      const dayTwoHours = clampPositiveHours((tmpl.duration_hours || 12) - 3)
      const nextDate = addDays(date, 1)
      const baseNote = tmpl.name || tmpl.code || 'Ночная смена'
      await scheduleService.createEntry({
        employee_id: Number(employeeId),
        date,
        start_time: tmpl.start_time,
        end_time: tmpl.end_time,
        planned_hours: dayOneHours,
        unit: unit,
        created_by: user.id,
        source: 'template-night',
        template_id: tmpl.id,
        note: `${baseNote} (часть 1 · ${dayOneHours}ч)`,
      })
      await scheduleService.createEntry({
        employee_id: Number(employeeId),
        date: nextDate,
        start_time: null,
        end_time: null,
        planned_hours: dayTwoHours,
        unit: unit,
        created_by: user.id,
        source: 'template-night',
        template_id: tmpl.id,
        note: scheduleMap.has(`${employeeId}-${nextDate}`) ? `${baseNote} (часть 2 · ${dayTwoHours}ч)` : `Отсыпной после ночи (${dayTwoHours}ч)`,
      })
      loadSchedule({ silent: true })
      return
    }

    const payload = {
      employee_id: Number(employeeId),
      date,
      start_time: tmpl.start_time,
      end_time: tmpl.end_time,
      planned_hours: clampPositiveHours(tmpl.duration_hours),
      unit: unit,
      created_by: user.id,
      source: tmpl.code || 'template',
      template_id: tmpl.id,
      note: tmpl.name || tmpl.code || 'Смена',
    }
    await scheduleService.createEntry(payload)
    loadSchedule({ silent: true })
  }

  const applyShiftAndClose = async (employeeId, date, shiftId) => {
    setSelectedShiftId(shiftId)
    await handleApplyShift(employeeId, date, shiftId)
    setSelectedCell(null)
  }

  const applyShiftToSelected = async (shiftId) => {
    if (!shiftId || !selectedCells.length) return
    setSelectedShiftId(shiftId)
    for (const cell of selectedCells) {
      // eslint-disable-next-line no-await-in-loop
      await handleApplyShift(cell.employeeId, cell.date, shiftId)
    }
    setSelectedCells([])
  }

  const handleApplyOverride = async (employeeId, date) => {
    return
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
                    <Badge variant="sky">{item.type}</Badge>
                    {!item.acknowledged && <Badge variant="emerald">Новое</Badge>}
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
                      <PillButton
                        key={t.key}
                        active={active}
                        activeClassName="bg-emerald-500 text-slate-950 border border-emerald-500 hover:bg-emerald-400"
                        inactiveClassName="border border-white/10 bg-slate-900 text-slate-100 hover:border-emerald-400/60"
                        onClick={() => {
                          setPositionTypeFilter((prev) =>
                            prev.includes(t.key) ? prev.filter((x) => x !== t.key) : [...prev, t.key],
                          )
                          setPositionFilter([])
                        }}
                      >
                        {t.label}
                      </PillButton>
                    )
                  })}
                </div>

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5">
                <span className="text-[10px] text-slate-400">Отделение:</span>
                {divisionOptions.map((div) => {
                  const active = divisionFilter.includes(div)
                  return (
                      <PillButton
                        key={div}
                        active={active}
                        onClick={() => {
                          setDivisionFilter((prev) => (prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]))
                          setPositionFilter([])
                        }}
                      >
                        {div}
                      </PillButton>
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
                    <div className="absolute left-0 top-7 z-50 w-52 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[10px] text-slate-100 shadow-lg">
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400">{monthDates.length} дней</span>
                {!!pinnedEmployees.length && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">
                    Показаны только закреплённые ({pinnedEmployees.length})
                  </span>
                )}
                {!!hiddenEmployees.length && !pinnedEmployees.length && (
                  <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-1 text-[11px] text-orange-100">
                    Скрыто: {hiddenEmployees.length}
                  </span>
                )}
                <span className="text-[11px] text-slate-400">Шифты: Cmd/Ctrl для точечного выбора, Shift для диапазона.</span>
              </div>
            </div>
            <div className="mt-2 relative isolate max-h-[70vh] overflow-auto rounded-2xl border border-white/10">
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
                      <Badge variant="neutral" className="px-1.5 text-[10px]">
                        {group.list.length}
                      </Badge>
                            </button>
                          </td>
                        </tr>
                        {!collapsed &&
                          group.list.map((emp) => (
                            <tr key={`${group.position}-${emp.id}`} className="border-t border-white/5">
                              <td className="sticky left-0 z-20 max-w-[240px] bg-slate-900/95 px-3 py-2 text-left text-sm font-semibold text-white">
                                <div className="flex items-center gap-2">
                                  <span className="truncate" title={emp.label}>
                                    {emp.label}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] font-normal">
                                    <button
                                      title={pinnedEmployees.includes(emp.id) ? 'Убрать закрепление' : 'Закрепить (показать только его)'}
                                      onClick={() =>
                                        setPinnedEmployees((prev) =>
                                          prev.includes(emp.id) ? prev.filter((id) => id !== emp.id) : [...prev, emp.id],
                                        )
                                      }
                                      className={`rounded-full px-2 py-0.5 transition ${
                                        pinnedEmployees.includes(emp.id)
                                          ? 'bg-emerald-500 text-slate-900'
                                          : 'border border-white/15 bg-white/5 text-slate-200 hover:border-emerald-400/60'
                                      }`}
                                    >
                                      Закр
                                    </button>
                                    <button
                                      title={hiddenEmployees.includes(emp.id) ? 'Показать сотрудника' : 'Скрыть сотрудника'}
                                      onClick={() =>
                                        setHiddenEmployees((prev) =>
                                          prev.includes(emp.id) ? prev.filter((id) => id !== emp.id) : [...prev, emp.id],
                                        )
                                      }
                                      className={`rounded-full px-2 py-0.5 transition ${
                                        hiddenEmployees.includes(emp.id)
                                          ? 'bg-slate-700 text-slate-300'
                                          : 'border border-white/15 bg-white/5 text-slate-200 hover:border-orange-400/60'
                                      }`}
                                    >
                                      Скрыть
                                    </button>
                                  </div>
                                </div>
                              </td>
                              {monthDates.map((d) => {
                                const shift = scheduleMap.get(`${emp.id}-${d}`)
                                return (
                                  <td
                                    key={`${emp.id}-${d}`}
                                    onClick={(e) => handleCellClick(emp.id, d, e)}
                                    className={`relative cursor-pointer px-1 py-1 align-top transition hover:bg-sky-500/10 ${
                                      selectedCell?.employeeId === emp.id && selectedCell?.date === d ? 'bg-sky-500/10' : ''
                                    }`}
                                  >
                                    <div className="rounded border border-white/10 bg-white/5 p-1 text-[10px] text-slate-300">
                                      {shift ? (
                                        <div className="flex min-h-[32px] flex-col gap-0.5">
                                          <span className="truncate">
                                            {shift.start_time && shift.end_time
                                              ? `${(shift.start_time || '').slice(0, 5)}–${(shift.end_time || '').slice(0, 5)}`
                                              : shift.note || 'Смена'}
                                          </span>
                                          <span className="text-[10px] text-slate-100">
                                            {shift.planned_hours !== null && shift.planned_hours !== undefined && shift.planned_hours !== ''
                                              ? `${Number(shift.planned_hours)} ч`
                                              : ''}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="h-[32px]" />
                                      )}
                                    </div>
                                    {(selectedCell?.employeeId === emp.id && selectedCell?.date === d) ||
                                    selectedCells.some((c) => c.employeeId === emp.id && c.date === d) ? (
                                      <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 text-[9px] font-semibold text-slate-900">
                                        ✓
                                      </span>
                                    ) : null}
                                    {menuCell?.employeeId === emp.id && menuCell?.date === d && (
                                      <div className="absolute left-1 top-9 z-50 w-52 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[11px] text-slate-100 shadow-xl">
                                        <p className="mb-1 text-[10px] uppercase tracking-[0.15em] text-slate-400">Выбрать смену</p>
                                        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                                          {shiftOptions.map((opt) => (
                                            <button
                                              key={opt.value}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                applyShiftAndClose(emp.id, d, opt.value)
                                              }}
                                              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-800/80 px-2 py-1 text-left transition hover:border-sky-400/60 hover:bg-slate-800"
                                            >
                                              <span>{opt.label}</span>
                                              <span className="text-[10px] text-slate-400">{opt.meta}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
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
            {selectedCells.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Ячеек выделено: {selectedCells.length}
                </span>
                {!!pinnedEmployees.length && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-emerald-100">
                    Закреплено сотрудников: {pinnedEmployees.length} (показываем только их)
                  </span>
                )}
                {!!hiddenEmployees.length && !pinnedEmployees.length && (
                  <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-orange-100">
                    Скрыто сотрудников: {hiddenEmployees.length}
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                  {shiftOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => applyShiftToSelected(opt.value)}
                      disabled={!selectedCells.length}
                      className="rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-[11px] text-slate-100 transition hover:border-sky-400/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {opt.label} ({opt.meta})
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedCells([])
                      setSelectionAnchor(null)
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-100 transition hover:border-red-400/60 hover:text-white"
                  >
                    Очистить выделение
                  </button>
                </div>
              </div>
            )}
            {selectedCell && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Ячейка {selectedCell.employeeId} · {new Date(selectedCell.date).toLocaleDateString('ru-RU')}
                </p>
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Смена / состояние</p>
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
                    Применить
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Список смен берётся из таблицы shift_templates. Выходной — planned_hours=0. Статусы (отпуск, больничный, отгул и т.д.) пишем в planned_hours согласно пресету.
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
