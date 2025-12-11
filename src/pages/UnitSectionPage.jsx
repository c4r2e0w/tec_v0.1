/* eslint-disable react-hooks/set-state-in-effect */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/Badge'
import { unitsMap, sectionsMap } from '../constants/units'
import { createEntriesService } from '../services/entriesService'
import { createScheduleService } from '../services/scheduleService'

const iconCatalog = {
  work: {
    color: '#f6c96f',
    glow: 'rgba(246, 201, 111, 0.5)',
    title: 'Рабочая смена',
    description: 'Штатный график, шаблоны и дневные смены.',
    icon: 'sun',
  },
  night: {
    color: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.45)',
    title: 'Ночная часть',
    description: 'Ночёвки и отсыпные 3/9.',
    icon: 'moon',
  },
  learning: {
    color: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.45)',
    title: 'Учеба/тренировки',
    description: 'Техучёба, противоаварийные тренировки.',
    icon: 'bulb',
  },
  special: {
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.45)',
    title: 'Спецдень',
    description: 'Командировка, донорский, особые статусы.',
    icon: 'alert',
  },
  rest: {
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.4)',
    title: 'Отдых',
    description: 'Выходной, отпуск, больничный, отгулы.',
    icon: 'cross',
  },
}

const getIconType = (shift) => {
  if (!shift) return null
  const source = (shift.source || '').toLowerCase()
  const note = (shift.note || '').toLowerCase()
  const hours = Number.isFinite(Number(shift.planned_hours)) ? Number(shift.planned_hours) : 0

  if (source.includes('night') || note.includes('ноч') || note.includes('отсып')) return 'night'
  if (note.includes('учеб') || note.includes('учёб') || note.includes('противоавар')) return 'learning'
  if (
    hours <= 0 ||
    note.includes('выход') ||
    note.includes('больнич') ||
    note.includes('отпуск') ||
    note.includes('отгул')
  )
    return 'rest'
  if (note.includes('донор') || note.includes('команд') || note.includes('декрет')) return 'special'
  return 'work'
}

const iconSvg = {
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2v2.5M12 19.5V22M4.5 4.5 6.3 6.3M17.7 17.7 19.5 19.5M2 12h2.5M19.5 12H22M4.5 19.5 6.3 17.7M17.7 6.3l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 14.2A7.5 7.5 0 0 1 9.8 4.5a7.5 7.5 0 1 0 9.7 9.7Z"
        fill="currentColor"
      />
      <path
        d="M17.3 15.2a6 6 0 0 1-8.5-8.5"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  cross: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5Z"
        fill="currentColor"
      />
      <path d="M10.5 4h3v7.5H21v3h-7.5V21h-3v-6.5H3v-3h7.5Z" fill="rgba(255,255,255,0.85)" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 3 20h18L12 2Z" fill="currentColor" />
      <path d="M12 8v5.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1" fill="rgba(255,255,255,0.9)" />
    </svg>
  ),
  bulb: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 18.2h5v1.3a2.5 2.5 0 0 1-2.5 2.5h-.1a2.5 2.5 0 0 1-2.4-2.5z"
        fill="currentColor"
      />
      <path
        d="M12 3.2a6 6 0 0 0-3 11.2v1.3a1.8 1.8 0 0 0 1.8 1.8h2.4a1.8 1.8 0 0 0 1.8-1.8v-1.3A6 6 0 0 0 12 3.2Z"
        fill="currentColor"
      />
      <path
        d="M10 16.3h4m-3.5-11h3m-4.3 2.5 1.4.5m4.8-1.7-1.3 1.4"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  ),
}

function ShiftIcon({ type, color = '#f6c96f', glow = 'rgba(246, 201, 111, 0.5)', size = 16, title = '' }) {
  const boxStyle = {
    boxShadow: `0 0 0 1px ${color}66, 0 0 0 6px ${glow}, 0 10px 25px ${glow}`,
  }
  const icon = iconSvg[type] || iconSvg.sun

  return (
    <span
      title={title}
      className="inline-flex items-center justify-center rounded-full bg-slate-950/85 ring-1 ring-white/5"
      style={{ width: size + 8, height: size + 8, color, ...boxStyle }}
    >
      {icon}
    </span>
  )
}

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
  const [positionsList, setPositionsList] = useState([])
  const [collapsedPositions, setCollapsedPositions] = useState([])
  const [pinnedEmployees, setPinnedEmployees] = useState([])
  const [hiddenEmployees, setHiddenEmployees] = useState([])
  const [selectedCells, setSelectedCells] = useState([])
  const MAX_DAY_HOURS = 12
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [positionFilter, setPositionFilter] = useState([])
  const [filterQueryInput, setFilterQueryInput] = useState('')
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const pinStorageKey = 'ktc_filters'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(pinStorageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFilterCategory(parsed.category || '')
        setFilterSection(parsed.section || '')
        setPositionFilter(parsed.positions || [])
        setFilterQuery(parsed.query || '')
        setFilterQueryInput(parsed.query || '')
      } catch {
        // ignore malformed
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      pinStorageKey,
      JSON.stringify({
        category: filterCategory,
        section: filterSection,
        positions: positionFilter,
        query: filterQuery,
      }),
    )
  }, [filterCategory, filterSection, positionFilter, filterQuery, pinStorageKey])

  useEffect(() => {
    const id = setTimeout(() => {
      setFilterQuery(filterQueryInput)
    }, 300)
    return () => clearTimeout(id)
  }, [filterQueryInput])

  const getPositionWeight = useCallback((name) => {
    const n = (name || '').toLowerCase()
    if (n.includes('начальник смены') && n.includes('ктц')) return 10
    if (n.includes('старший машинист') && n.includes('котель')) return 20
    if (n.includes('старший машинист') && n.includes('турбин')) return 20
    if (n.includes('машинист щита')) return 30
    if (n.includes('обходчик') && n.includes('6')) return 40
    if (n.includes('обходчик') && n.includes('5')) return 50
    if (n.includes('обходчик') && n.includes('4')) return 60
    return 999
  }, [])

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

  const deleteNightParts = async (employeeId, dates, pending) => {
    const isNightSource = (entry) => ['status-night', 'template-night'].includes(entry?.source)
    const tasks = dates.map((dt) => {
      const key = `${employeeId}-${dt}`
      if (pending?.has) {
        const filtered = (pending.get(key) || []).filter((e) => !isNightSource(e))
        pending.set(key, filtered)
      }
      const entries = scheduleByDay?.get ? scheduleByDay.get(key) || [] : []
      const nightEntry = entries.find(isNightSource)
      if (nightEntry) {
        return scheduleService.deleteEntry({ employeeId: Number(employeeId), date: dt })
      }
      return Promise.resolve()
    })
    await Promise.all(tasks)
  }

  const resetFilters = () => {
    setFilterCategory('')
    setFilterSection('')
    setPositionFilter([])
    setFilterQuery('')
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

  const positionsMap = useMemo(() => Object.fromEntries((positionsList || []).map((p) => [p.id, p])), [positionsList])

  const staffWithLabels = useMemo(() => {
    const src = staff.length ? staff : []
    return src
      .map((emp) => {
        const label = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ') || `ID ${emp.id}`
        const position = emp.positions?.name || positionsMap[emp.position_id]?.name || ''
        const division = emp.positions?.devision_name || positionsMap[emp.position_id]?.devision_name || ''
        const department = emp.positions?.departament_name || positionsMap[emp.position_id]?.departament_name || ''
        const positionType = emp.positions?.type || positionsMap[emp.position_id]?.type || ''
        const weight = emp.positions?.sort_weight ?? positionsMap[emp.position_id]?.sort_weight ?? getPositionWeight(position)
        return { id: emp.id, label, position, division, department, positionType, weight }
      })
      .sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
  }, [staff, positionsMap, getPositionWeight])

  const employeesFromSchedule = useMemo(() => {
    const map = new Map()
    staffWithLabels.forEach((e) => map.set(e.id, e))
    if (!map.size) {
      scheduleRows.forEach((row) => {
        const label = row.employees
          ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
          : `ID ${row.employee_id}`
        const posName = row.employees?.positions?.name || ''
        map.set(row.employee_id, {
          id: row.employee_id,
          label,
          position: posName,
          division: row.employees?.positions?.devision_name || '',
          department: row.employees?.positions?.departament_name || '',
          positionType: row.employees?.positions?.type || '',
          weight: row.employees?.positions?.sort_weight ?? getPositionWeight(posName),
        })
      })
    }
    let list = Array.from(map.values())
    const pinnedSet = new Set(pinnedEmployees)
    const hiddenSet = new Set(hiddenEmployees)
    if (pinnedSet.size) {
      list = list.filter((e) => pinnedSet.has(e.id))
    } else if (hiddenSet.size) {
      list = list.filter((e) => !hiddenSet.has(e.id))
    }
    if (positionFilter.length) {
      const set = new Set(positionFilter)
      list = list.filter((e) => set.has(e.position))
    }
    list = list.map((e) => (e.weight !== undefined ? e : { ...e, weight: getPositionWeight(e.position) }))
    list.sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
    return list
  }, [staffWithLabels, scheduleRows, pinnedEmployees, hiddenEmployees, positionFilter, getPositionWeight])

  const scheduleMap = new Map(scheduleRows.map((row) => [`${row.employee_id}-${row.date}`, row]))
  const scheduleByDay = useMemo(() => {
    const map = new Map()
    scheduleRows.forEach((row) => {
      const key = `${row.employee_id}-${row.date}`
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    })
    return map
  }, [scheduleRows])
  const mergeEntriesForDate = useCallback(
    (employeeId, date, pending) => {
      const key = `${employeeId}-${date}`
      const base = scheduleByDay?.get ? scheduleByDay.get(key) || [] : []
      const extra = pending?.get ? pending.get(key) || [] : []
      return extra.length ? base.concat(extra) : base
    },
    [scheduleByDay],
  )
  const pentagramTypesInSchedule = useMemo(() => {
    const types = new Set()
    scheduleRows.forEach((row) => {
      const type = getIconType(row)
      if (type) types.add(type)
    })
    return Array.from(types)
  }, [scheduleRows])
  const resolveIconType = useCallback(
    (list) => {
      if (!list?.length) return null
      const priority = ['night', 'special', 'learning', 'work', 'rest']
      for (const type of priority) {
        const found = list.some((item) => getIconType(item) === type)
        if (found) return type
      }
      return null
    },
    [getIconType],
  )
  const formatCellValue = useCallback((list) => {
    if (!list?.length) return '—'
    const noteMix = list.find((i) => (i.note || '').toLowerCase().includes('9/3'))
    if (noteMix) return '9/3'
    const hours = list
      .map((item) => {
        const raw = item?.planned_hours
        if (raw === null || raw === undefined || raw === '') return null
        const num = Number(raw)
        return Number.isFinite(num) ? num : null
      })
      .filter((num) => num !== null)
    if (hours.length > 1) {
      const ordered = [...hours].sort((a, b) => b - a)
      return ordered.map((h) => String(h)).join('/')
    }
    if (hours.length === 1) {
      const val = hours[0]
      if (val === 0) return (list.find((i) => i.note)?.note || '').slice(0, 6) || '0'
      return `${val}`
    }
    return (list.find((i) => i.note)?.note || '').slice(0, 6) || '—'
  }, [])
  const shiftMenuPosition = useMemo(() => {
    if (!menuCell) return null
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200
    const pos = menuCell.position || {}
    const baseLeft = (pos.left ?? 0) + 8
    const left = Math.min(Math.max(12, baseLeft), width - 240)
    const top = (pos.bottom ?? pos.top ?? 0) + 8
    return { left, top }
  }, [menuCell])

  const groupedByPosition = useMemo(() => {
    const map = new Map()
    employeesFromSchedule.forEach((emp) => {
      const key = emp.position || 'Без должности'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(emp)
    })
    return Array.from(map.entries())
      .map(([position, list]) => {
        const sorted = [...list].sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
        const minWeight = sorted[0]?.weight ?? 999
        return { position, list: sorted, minWeight }
      })
      .sort((a, b) => a.minWeight - b.minWeight || a.position.localeCompare(b.position, 'ru'))
  }, [employeesFromSchedule])

  const positionOptions = useMemo(() => {
    let list = positionsList
    if (filterCategory) {
      const cat = filterCategory === 'operational' ? 'Оперативный' : 'Административно-технический'
      list = list.filter((p) => (p.type || '').toLowerCase() === cat.toLowerCase())
    }
    if (filterSection) {
      const sectionMap = {
        turbine: 'Турбинное отделение',
        boiler: 'Котельное отделение',
      }
      const target = sectionMap[filterSection] || filterSection
      const lower = (target || '').toLowerCase()
      list = list.filter(
        (p) => (p.devision_name || '').toLowerCase() === lower || (p.departament_name || '').toLowerCase() === lower,
      )
    }
    return list
      .map((p) => ({ label: p.name, weight: p.sort_weight ?? getPositionWeight(p.name) }))
      .sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
      .map((item) => item.label)
  }, [positionsList, filterCategory, filterSection, getPositionWeight])

  const visibleRows = useMemo(() => {
    const list = []
    groupedByPosition.forEach((group) => {
      if (collapsedPositions.includes(group.position)) return
      group.list.forEach((emp) => list.push(emp))
    })
    return list
  }, [collapsedPositions, groupedByPosition])

  const employeeIndexMap = useMemo(() => new Map(visibleRows.map((e, idx) => [e.id, idx])), [visibleRows])

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
    if (section !== 'personnel' || !user) return
    setLoadingStaff(true)
    setStaffError('')
    // Отфильтруем должности заранее
    let filteredPositions = positionsList
    if (filterCategory) {
      const cat = filterCategory === 'operational' ? 'Оперативный' : 'Административно-технический'
      filteredPositions = filteredPositions.filter((p) => (p.type || '').toLowerCase() === cat.toLowerCase())
    }
    if (filterSection) {
      const sectionMap = {
        turbine: 'Турбинное отделение',
        boiler: 'Котельное отделение',
      }
      const target = sectionMap[filterSection] || filterSection
      const lower = (target || '').toLowerCase()
      filteredPositions = filteredPositions.filter(
        (p) => (p.devision_name || '').toLowerCase() === lower || (p.departament_name || '').toLowerCase() === lower,
      )
    }
    if (positionFilter.length) {
      const set = new Set(positionFilter)
      filteredPositions = filteredPositions.filter((p) => set.has(p.name))
    }
    const positionIds = filteredPositions.map((p) => p.id)
    const { data, error } = await scheduleService.fetchEmployeesByUnit({
      positionIds,
      query: filterQuery || null,
    })
    if (error) {
      setStaffError(error.message)
      setLoadingStaff(false)
      return
    }
    setStaff(data || [])
    setSelectedCells([])
    setSelectionAnchor(null)
    setLoadingStaff(false)
  }, [scheduleService, section, user, filterCategory, filterSection, positionFilter, filterQuery, positionsList])

  const loadShiftTemplates = useCallback(async () => {
    const { data, error } = await scheduleService.fetchShiftTemplates()
    if (!error) setShiftTemplates(data || [])
  }, [scheduleService])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  useEffect(() => {
    const loadPositions = async () => {
      const { data, error } = await scheduleService.fetchPositions()
      if (!error) setPositionsList(data || [])
    }
    loadPositions()
  }, [scheduleService])

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
      const rect = event?.currentTarget?.getBoundingClientRect?.()
      const position = rect
        ? {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          }
        : null

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
        setMenuCell({ employeeId, date, position })
        return
      }

      if (isMeta) {
        setSelectionAnchor(selectionAnchor || { employeeId, date })
        setSelectedCell({ employeeId, date })
        setMenuCell({ employeeId, date, position })
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
      setMenuCell({ employeeId, date, position })
    },
    [employeeIndexMap, monthDates, selectionAnchor, visibleRows],
  )

  const handleApplyShift = async (employeeId, date, shiftIdArg, opts = {}) => {
    if (!user || !employeeId || !date) return
    const shiftId = shiftIdArg ?? selectedShiftId
    const pending = opts.pending
    const skipReload = opts.skipReload
    if (!shiftId) return
    if (shiftId === 'clear') {
      await deleteNightParts(employeeId, [addDays(date, -1), date, addDays(date, 1)], pending)
      await scheduleService.deleteEntry({ employeeId: Number(employeeId), date })
      if (pending?.set) pending.set(`${employeeId}-${date}`, [])
      if (!skipReload) loadSchedule({ silent: true })
      return
    }
    if (shiftId === 'off') {
      await deleteNightParts(employeeId, [addDays(date, -1), date, addDays(date, 1)], pending)
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
      if (!skipReload) loadSchedule({ silent: true })
      return
    }

    const custom = customShiftMap[shiftId]
    // Если ставим любую смену кроме ночной — уберём ночные хвосты на день и следующий
    if (shiftId !== 'night12') {
      await deleteNightParts(employeeId, [addDays(date, -1), date, addDays(date, 1)], pending)
    }
    if (custom) {
      // Спец-логика для ночной 3/9
      if (shiftId === 'night12') {
        const existingList = mergeEntriesForDate(employeeId, date, pending)
        const hasTailFromPrev = existingList.some(
          (item) => ['status-night', 'template-night'].includes(item?.source) && Number(item.planned_hours || 0) >= 9,
        )
        const dayOneHours = clampPositiveHours(3)
        const dayTwoHours = clampPositiveHours((custom.hours || 12) - 3)
        const nextDate = addDays(date, 1)
        // чистим будущий хвост, но если есть хвост 9ч с предыдущей ночи — не трогаем его
        await deleteNightParts(employeeId, [nextDate], pending)
        if (hasTailFromPrev) {
          const mergedPayload = {
            employee_id: Number(employeeId),
            date,
            start_time: null,
            end_time: null,
            planned_hours: clampPositiveHours(custom.hours || 12),
            unit: unit,
            created_by: user.id,
            source: 'status-night',
            note: 'Ночная (9/3)',
          }
          await scheduleService.createEntry(mergedPayload)
          if (pending?.set) {
            const key = `${employeeId}-${date}`
            pending.set(key, [
              ...mergeEntriesForDate(employeeId, date, pending).filter((e) => !['status-night', 'template-night'].includes(e.source)),
              mergedPayload,
            ])
          }
        } else {
          const noteToday = 'Ночная (3/9)'
          const entryToday = {
            employee_id: Number(employeeId),
            date,
            start_time: null,
            end_time: null,
            planned_hours: dayOneHours,
            unit: unit,
            created_by: user.id,
            source: 'status-night',
            note: noteToday,
          }
          await scheduleService.createEntry(entryToday)
          if (pending?.set) {
            const key = `${employeeId}-${date}`
            const list = mergeEntriesForDate(employeeId, date, pending).filter((e) => e !== entryToday)
            pending.set(key, [...list.filter((e) => e.source !== 'status-night'), entryToday])
          }
        }
        const entryNext = {
          employee_id: Number(employeeId),
          date: nextDate,
          start_time: null,
          end_time: null,
          planned_hours: dayTwoHours,
          unit: unit,
          created_by: user.id,
          source: 'status-night',
          note: 'Отсыпной после ночи (9ч)',
        }
        await scheduleService.createEntry(entryNext)
        if (pending?.set) {
          const keyNext = `${employeeId}-${nextDate}`
          pending.set(keyNext, [...mergeEntriesForDate(employeeId, nextDate, pending).filter((e) => e !== entryNext), entryNext])
        }
        if (!skipReload) loadSchedule({ silent: true })
        return
      }
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
      if (pending?.set) {
        const key = `${employeeId}-${date}`
        pending.set(key, [...mergeEntriesForDate(employeeId, date, pending), { ...payload, source: 'status' }])
      }
      if (!skipReload) loadSchedule({ silent: true })
      return
    }

    const tmpl = shiftTemplateMap[shiftId]
    if (!tmpl) return
    if (isNightSplitTemplate(tmpl)) {
        const existingList = mergeEntriesForDate(employeeId, date, pending)
        const hasTailFromPrev = existingList.some(
          (item) => ['status-night', 'template-night'].includes(item?.source) && Number(item.planned_hours || 0) >= 9,
        )
        const dayOneHours = clampPositiveHours(3)
        const dayTwoHours = clampPositiveHours((tmpl.duration_hours || 12) - 3)
        const nextDate = addDays(date, 1)
        const baseNote = tmpl.name || tmpl.code || 'Ночная смена'
        await deleteNightParts(employeeId, [nextDate], pending)
        if (!hasTailFromPrev) {
          await deleteNightParts(employeeId, [date], pending)
        }
        const entryToday = hasTailFromPrev
          ? {
              employee_id: Number(employeeId),
              date,
              start_time: tmpl.start_time,
              end_time: tmpl.end_time,
              planned_hours: clampPositiveHours(tmpl.duration_hours || 12),
              unit: unit,
              created_by: user.id,
              source: 'template-night',
              template_id: tmpl.id,
              note: `${baseNote} (9/3)`,
            }
          : {
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
            }
        await scheduleService.createEntry(entryToday)
        if (pending?.set) {
          const key = `${employeeId}-${date}`
          pending.set(key, [...mergeEntriesForDate(employeeId, date, pending).filter((e) => e !== entryToday), entryToday])
        }
      const entryNext = {
        employee_id: Number(employeeId),
        date: nextDate,
        start_time: null,
        end_time: null,
        planned_hours: dayTwoHours,
        unit: unit,
        created_by: user.id,
        source: 'template-night',
        template_id: tmpl.id,
        note: scheduleMap.has(`${employeeId}-${nextDate}`) // если там уже есть что-то, сохраняем пояснение
          ? `${baseNote} (часть 2 · ${dayTwoHours}ч)`
          : `Отсыпной после ночи (${dayTwoHours}ч)`,
      }
      await scheduleService.createEntry(entryNext)
      if (pending?.set) {
        const keyNext = `${employeeId}-${nextDate}`
        pending.set(keyNext, [...mergeEntriesForDate(employeeId, nextDate, pending).filter((e) => e !== entryNext), entryNext])
      }
      if (!skipReload) loadSchedule({ silent: true })
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
    if (pending?.set) {
      const key = `${employeeId}-${date}`
      pending.set(key, [...mergeEntriesForDate(employeeId, date, pending), { ...payload, source: tmpl.code || 'template' }])
    }
    if (!skipReload) loadSchedule({ silent: true })
  }

  const applyShiftToSelected = async (shiftId) => {
    if (!shiftId || !selectedCells.length) return
    setSelectedShiftId(shiftId)
    const unique = new Map()
    selectedCells.forEach((c) => unique.set(`${c.employeeId}-${c.date}`, c))
    const pending = new Map()
    for (const cell of unique.values()) {
      await handleApplyShift(cell.employeeId, cell.date, shiftId, { pending, skipReload: true })
    }
    await loadSchedule({ silent: true })
    setSelectedCells([])
    setMenuCell(null)
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
            <div className="mt-3 flex flex-col gap-2 text-[11px] text-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                >
                  <option value="">Категория: все</option>
                  <option value="administrative">АТП</option>
                  <option value="operational">Оперативный</option>
                </select>
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
                >
                  <option value="">Отделение: оба</option>
                  <option value="turbine">Турбинное</option>
                  <option value="boiler">Котельное</option>
                </select>
                <div className="relative">
                  <button
                    onClick={() => setPositionsOpen((p) => !p)}
                    className="h-[34px] rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white transition hover:border-sky-400/60 disabled:opacity-60"
                  >
                    {positionFilter.length ? `Должности: ${positionFilter.length}` : 'Должности'}
                  </button>
                  {positionsOpen && (
                    <div className="absolute left-0 top-9 z-50 w-56 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[11px] text-slate-100 shadow-xl">
                      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
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
                              <span className="truncate">{pos}</span>
                            </label>
                          )
                        })}
                        {!positionOptions.length && <span className="text-slate-500">Нет должностей</span>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setPositionFilter([])}
                          className="flex-1 rounded-full border border-white/10 bg-slate-800 px-2 py-1 text-[11px] text-white transition hover:border-sky-400/60"
                        >
                          Очистить
                        </button>
                        <button
                          onClick={() => setPositionsOpen(false)}
                          className="flex-1 rounded-full border border-emerald-400/40 bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-emerald-400"
                        >
                          Готово
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={resetFilters}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-100 transition hover:border-red-400/60 hover:text-white"
                >
                  Сброс
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={filterQueryInput}
                  onChange={(e) => setFilterQueryInput(e.target.value)}
                  placeholder="Поиск ФИО"
                  className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {filterCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white">
                    {filterCategory === 'administrative' ? 'АТП' : 'Оперативный'}
                    <button onClick={() => setFilterCategory('')} className="text-slate-400 hover:text-white">
                      ×
                    </button>
                  </span>
                )}
                {filterSection && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white">
                    {filterSection === 'turbine' ? 'Турбинное' : 'Котельное'}
                    <button onClick={() => setFilterSection('')} className="text-slate-400 hover:text-white">
                      ×
                    </button>
                  </span>
                )}
                {filterQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white">
                    Поиск по ФИО: {filterQuery}
                    <button
                      onClick={() => {
                        setFilterQuery('')
                        setFilterQueryInput('')
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                )}
                {positionFilter.map((pos) => (
                  <span
                    key={pos}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white"
                  >
                    {pos}
                    <button
                      onClick={() => setPositionFilter((prev) => prev.filter((p) => p !== pos))}
                      className="text-slate-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            {loadingSchedule && <p className="mt-2 text-xs text-slate-400">Загрузка...</p>}
            {loadingStaff && <p className="mt-1 text-xs text-slate-400">Загружаем сотрудников...</p>}
            {staffError && <p className="mt-1 text-xs text-orange-300">Ошибка загрузки сотрудников: {staffError}</p>}
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
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">
                    Показаны только закреплённые ({pinnedEmployees.length})
                    <button
                      onClick={() => setPinnedEmployees([])}
                      className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white transition hover:border-sky-400/60"
                    >
                      Показать всех
                    </button>
                  </span>
                )}
                {!!hiddenEmployees.length && (
                  <button
                    onClick={() => {
                      setHiddenEmployees([])
                    }}
                    className="rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-1 text-[11px] text-orange-100 transition hover:border-orange-300 hover:text-orange-50"
                  >
                    Скрыто: {hiddenEmployees.length} · Показать всех
                  </button>
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
                          group.list.map((emp) => {
                            const hiddenRow = hiddenEmployees.includes(emp.id)
                            return (
                              <tr
                                key={`${group.position}-${emp.id}`}
                                className={`border-t border-white/5 ${hiddenRow ? 'hidden' : ''}`}
                              >
                                <td className="sticky left-0 z-20 max-w-[240px] bg-slate-900/95 px-3 py-2 text-left text-sm font-semibold text-white">
                                  <div className="relative flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedEmployeeId(emp.id)}
                                      className={`origin-left text-left transition ${
                                        selectedEmployeeId === emp.id
                                          ? 'scale-[1.05] text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                                          : 'text-slate-100'
                                      }`}
                                      title={emp.label}
                                    >
                                      {emp.label}
                                    </button>
                                    {selectedEmployeeId === emp.id && !pinnedEmployees.includes(emp.id) && (
                                      <div className="absolute left-0 top-6 z-30 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[11px] text-slate-100 shadow-xl">
                                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Действия</p>
                                        <button
                                          onClick={() => {
                                            setPinnedEmployees([emp.id])
                                            setSelectedEmployeeId(null)
                                          }}
                                          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left transition hover:border-sky-400/60 hover:bg-slate-800"
                                        >
                                          Скрыть остальных
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                {monthDates.map((d) => {
                                  const key = `${emp.id}-${d}`
                                  const cellEntries = scheduleByDay.get(key) || []
                                  const displayValue = formatCellValue(cellEntries)
                                  const pentagramType = resolveIconType(cellEntries)
                                  const pentagramMeta = pentagramType ? iconCatalog[pentagramType] : null
                                  const isSelected =
                                    (selectedCell?.employeeId === emp.id && selectedCell?.date === d) ||
                                    selectedCells.some((c) => c.employeeId === emp.id && c.date === d)
                                  return (
                                    <td
                                      key={`${emp.id}-${d}`}
                                      onClick={(e) => handleCellClick(emp.id, d, e)}
                                      className={`relative cursor-pointer px-1 py-1 align-top transition hover:bg-sky-500/10 ${
                                        selectedCell?.employeeId === emp.id && selectedCell?.date === d ? 'bg-sky-500/10' : ''
                                      }`}
                                    >
                                      <div
                                        className={`flex min-h-[32px] items-center justify-center gap-1.5 rounded border bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-100 transition ${
                                          isSelected
                                            ? 'cell-selected border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-500/30'
                                            : 'border-white/10'
                                        }`}
                                        title={pentagramMeta?.title || ''}
                                      >
                                        {pentagramMeta && (
                                          <ShiftIcon
                                            type={pentagramMeta.icon}
                                            color={pentagramMeta.color}
                                            glow={pentagramMeta.glow}
                                            size={12}
                                            title={pentagramMeta.title}
                                          />
                                        )}
                                        <span className="leading-none">{displayValue}</span>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
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
            {menuCell && typeof document !== 'undefined' && (
              createPortal(
                <div className="fixed inset-0 z-[120] pointer-events-none">
                  <div
                    className="absolute pointer-events-auto w-56 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[11px] text-slate-100 shadow-2xl"
                    style={{
                      left: shiftMenuPosition?.left ?? 24,
                      top: shiftMenuPosition?.top ?? 80,
                      maxHeight: '70vh',
                      overflow: 'hidden',
                      overflowY: 'auto',
                    }}
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-400">
                      <span>Выбрать смену</span>
                      <button
                        onClick={() => setMenuCell(null)}
                        className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        ×
                      </button>
                    </div>
                    <div
                      className="flex max-h-60 flex-col gap-1 overflow-y-auto pr-1"
                      onWheel={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {shiftOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={(e) => {
                            e.stopPropagation()
                            applyShiftToSelected(opt.value)
                          }}
                          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-800/80 px-2 py-1 text-left transition hover:border-sky-400/60 hover:bg-slate-800"
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] text-slate-400">{opt.meta}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>,
                document.body,
              )
            )}
            {pentagramTypesInSchedule.length > 0 && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-[11px] text-slate-100">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Легенда смен</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pentagramTypesInSchedule.map((type) => {
                    const meta = iconCatalog[type]
                    if (!meta) return null
                    return (
                      <div
                        key={type}
                        className="flex min-w-[220px] items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 shadow-inner shadow-black/10"
                      >
                        <ShiftIcon type={meta.icon} color={meta.color} glow={meta.glow} size={18} title={meta.title} />
                        <div className="leading-tight">
                          <div className="text-[11px] font-semibold text-white">{meta.title}</div>
                          <div className="text-[10px] text-slate-400">{meta.description}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
                <button
                  onClick={() => {
                    setSelectedCells([])
                    setSelectionAnchor(null)
                    setMenuCell(null)
                  }}
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-100 transition hover:border-red-400/60 hover:text-white"
                >
                  Очистить выделение
                </button>
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
