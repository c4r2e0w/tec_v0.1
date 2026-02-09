import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../hooks/useAuth'
import Badge from '../components/Badge'
import { unitsMap, sectionsMap } from '../constants/units'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
import PersonnelSchedule from '../components/PersonnelSchedule'
import { productionCalendar } from '../constants/productionCalendar'
import { getMonthCalendarMeta } from '../lib/productionNorm'

const iconCatalog = {
  work: {
    color: '#cbd5e1',
    glow: 'transparent',
    title: 'Рабочая смена',
    description: 'Штатный график, шаблоны и дневные смены.',
    icon: 'sun',
  },
  sleep: {
    color: '#cbd5e1',
    glow: 'transparent',
    title: 'Отсыпной после ночи',
    description: 'Отсыпной день (9ч) после ночной.',
    icon: 'bed',
  },
  night: {
    color: '#cbd5e1',
    glow: 'transparent',
    title: 'Ночная часть',
    description: 'Ночёвки и отсыпные 3/9.',
    icon: 'moon',
  },
  learning: {
    color: '#cbd5e1',
    glow: 'transparent',
    title: 'Учеба/тренировки',
    description: 'Техучёба, противоаварийные тренировки.',
    icon: 'bulb',
  },
  special: {
    color: '#cbd5e1',
    glow: 'transparent',
    title: 'Спецдень',
    description: 'Командировка, донорский, особые статусы.',
    icon: 'alert',
  },
  rest: {
    color: '#cbd5e1',
    glow: 'transparent',
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

  if (note.includes('отсып') || (source.includes('night') && hours >= 9)) return 'sleep'
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

const normalizeRoleTextValue = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isOperationalType = (value) => normalizeRoleTextValue(value).includes('оператив')
const isChiefPosition = (value) => {
  const normalized = normalizeRoleTextValue(value)
  return normalized.includes('начальник смены') || normalized.includes('нач смены')
}
const SHIFT_ANCHOR_DATE = '2026-02-09' // day shift = А

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
  bed: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 9.2h4l-4 3.6h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 6.8h3l-3 2.7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 4.8h2l-2 1.8h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

function ShiftIcon({
  type,
  color = '#f6c96f',
  glow = 'rgba(246, 201, 111, 0.5)',
  size = 16,
  title = '',
  minimal = false,
  className = '',
}) {
  const resolvedColor = minimal ? '#cbd5e1' : color
  const boxStyle = minimal ? {} : { boxShadow: `0 0 0 1px ${resolvedColor}66, 0 0 0 6px ${glow}, 0 10px 25px ${glow}` }
  const icon = iconSvg[type] || iconSvg.sun
  const baseClass = minimal
    ? 'inline-flex items-center justify-center text-slate-300'
    : 'inline-flex items-center justify-center rounded-full bg-slate-950/85 ring-1 ring-white/5'

  return (
    <span
      title={title}
      className={`${baseClass} ${className}`.trim()}
      style={{ width: minimal ? size : size + 8, height: minimal ? size : size + 8, color: resolvedColor, ...boxStyle }}
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
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const shiftWorkflowService = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const { user } = useAuth()
  const profile = useProfile()
  const journalCode = 'ktc-docs'
  const journalName = 'Журнал КТЦ (документы)'
  const [newEntry, setNewEntry] = useState({ type: 'admin', title: '', body: '' })
  const [selectedTypes, setSelectedTypes] = useState(['admin', 'turbine', 'boiler', 'daily'])
  const {
    entries,
    lastSeenAt,
    loadingEntries,
    refreshing,
    entriesError,
    saving,
    ackLoadingId,
    markAllLoading,
    createEntry,
    acknowledgeEntry,
    markAllRead,
    refreshEntries,
    setEntriesError,
  } = useJournal({
    enabled: isKtc && section === 'docs' && !!user,
    journalCode,
    journalName,
    profileId: user?.id,
  })
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
  const [workplaces, setWorkplaces] = useState([])
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [activeShiftPermissions, setActiveShiftPermissions] = useState([])
  const [manualWorkplaceAssignments, setManualWorkplaceAssignments] = useState({})
  const [manualChiefAssignments, setManualChiefAssignments] = useState({})
  const [expandedWorkplaceSelects, setExpandedWorkplaceSelects] = useState({})
  const [sessionEmployeeIdsBySlot, setSessionEmployeeIdsBySlot] = useState({})
  const [assignmentSessionId, setAssignmentSessionId] = useState(null)
  const [savingWorkplaces, setSavingWorkplaces] = useState(false)
  const [workplaceSaveMessage, setWorkplaceSaveMessage] = useState('')
  const [workplaceSaveError, setWorkplaceSaveError] = useState('')
  const [confirmingWorkplaces, setConfirmingWorkplaces] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(pinStorageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        queueMicrotask(() => {
          setFilterCategory(parsed.category || '')
          setFilterSection(parsed.section || '')
          setPositionFilter(parsed.positions || [])
          setFilterQuery(parsed.query || '')
          setFilterQueryInput(parsed.query || '')
        })
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
    const d = parseIsoLocalDate(dateStr)
    d.setDate(d.getDate() + days)
    return toIsoLocalDate(d)
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
    setSelectedEmployeeIds([])
    setSelectedCells([])
    setSelectionAnchor(null)
    setMenuCell(null)
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
    return toIsoLocalDate(d)
  })

  const monthDates = useMemo(() => {
    const result = []
    const start = parseIsoLocalDate(monthStart)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(0) // последний день месяца
    const days = end.getDate()
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      result.push(toIsoLocalDate(d))
    }
    return result
  }, [monthStart])

  const monthLabel = useMemo(() => {
    const d = new Date(monthStart)
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }, [monthStart])
  const monthNorm = useMemo(() => {
    const d = new Date(monthStart)
    const year = d.getUTCFullYear()
    const monthIndex = d.getUTCMonth() + 1
    return getMonthCalendarMeta({
      year,
      month: monthIndex,
      calendar: productionCalendar,
    })
  }, [monthStart])
  const headerTitle = useMemo(() => {
    if (section === 'personnel') return `Персонал / ГРАФИК · ${monthLabel}`
    return sectionLabel
  }, [section, monthLabel, sectionLabel])
  const addDaysIso = useCallback((dateStr, days) => {
    const d = parseIsoLocalDate(dateStr)
    d.setDate(d.getDate() + days)
    return toIsoLocalDate(d)
  }, [])
  const currentShiftDate = useMemo(() => toIsoLocalDate(new Date()), [])
  const currentShiftType = useMemo(() => {
    const hour = new Date().getHours()
    return hour >= 20 || hour < 8 ? 'night' : 'day'
  }, [])
  const shiftCodes = useMemo(() => ['А', 'Б', 'В', 'Г'], [])
  const shiftSlotTypeLabel = useCallback((type) => (type === 'night' ? 'Ночь' : 'День'), [])
  const shiftCodeForSlot = useCallback((dateStr, type) => {
    const diffMs = parseIsoLocalDate(dateStr).getTime() - parseIsoLocalDate(SHIFT_ANCHOR_DATE).getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    const dayIndex = ((diffDays % shiftCodes.length) + shiftCodes.length) % shiftCodes.length
    const index = type === 'night' ? ((dayIndex - 1 + shiftCodes.length) % shiftCodes.length) : dayIndex
    return shiftCodes[index] || '—'
  }, [shiftCodes])
  const baseShiftDate = useMemo(() => {
    if (currentShiftType !== 'night') return currentShiftDate
    const nowHour = new Date().getHours()
    // Ночная смена 20:00-08:00 относится к дате начала смены.
    if (nowHour < 8) return addDaysIso(currentShiftDate, -1)
    return currentShiftDate
  }, [addDaysIso, currentShiftDate, currentShiftType])
  const baseShiftType = useMemo(() => currentShiftType, [currentShiftType])
  const resolveShiftSlot = useCallback(
    (delta = 0) => {
      let date = baseShiftDate
      let type = baseShiftType
      let remain = delta
      while (remain > 0) {
        if (type === 'day') {
          type = 'night'
        } else {
          type = 'day'
          date = addDaysIso(date, 1)
        }
        remain -= 1
      }
      while (remain < 0) {
        if (type === 'night') {
          type = 'day'
        } else {
          type = 'night'
          date = addDaysIso(date, -1)
        }
        remain += 1
      }
      return { date, type }
    },
    [addDaysIso, baseShiftDate, baseShiftType],
  )
  const [viewedShiftOffset, setViewedShiftOffset] = useState(0)
  useEffect(() => {
    if (section !== 'personnel') return
    const timer = setTimeout(() => setViewedShiftOffset(0), 0)
    return () => clearTimeout(timer)
  }, [section, unit])
  const activeShiftSlot = useMemo(() => resolveShiftSlot(viewedShiftOffset), [resolveShiftSlot, viewedShiftOffset])
  const activeShiftDate = activeShiftSlot.date
  const activeShiftType = activeShiftSlot.type
  const nextShiftSlot = useMemo(() => resolveShiftSlot(viewedShiftOffset + 1), [resolveShiftSlot, viewedShiftOffset])

  const scopeForEntryType = useCallback((entryType) => {
    if (entryType === 'daily') return 'daily_statement'
    if (entryType === 'turbine' || entryType === 'boiler') return 'operational_log'
    if (entryType === 'admin') return 'shift_control'
    return null
  }, [])
  const canCreateEntryByShift = useMemo(() => {
    if (section !== 'docs' || unit !== 'ktc') return true
    const requiredScope = scopeForEntryType(newEntry.type)
    if (!requiredScope) return true
    return activeShiftPermissions.some((row) => row.scope === requiredScope)
  }, [activeShiftPermissions, newEntry.type, scopeForEntryType, section, unit])

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
        return { id: emp.id, label, position, position_id: emp.position_id || null, division, department, positionType, weight }
      })
      .sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
  }, [staff, positionsMap, getPositionWeight])

  const allEmployeesFromSchedule = useMemo(() => {
    const map = new Map()
    const filteredRows = unit ? scheduleRows.filter((row) => row.unit === unit) : scheduleRows
    staffWithLabels.forEach((e) => map.set(e.id, e))
    filteredRows.forEach((row) => {
      const label = row.employees
        ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
        : `ID ${row.employee_id}`
      const posName = row.employees?.positions?.name || ''
      const fromRow = {
        id: row.employee_id,
        label,
        position: posName,
        position_id: row.employees?.position_id || null,
        division: row.employees?.positions?.devision_name || '',
        department: row.employees?.positions?.departament_name || '',
        positionType: row.employees?.positions?.type || '',
        weight: row.employees?.positions?.sort_weight ?? getPositionWeight(posName),
      }
      const prev = map.get(row.employee_id)
      map.set(row.employee_id, {
        ...fromRow,
        ...(prev || {}),
        position: prev?.position || fromRow.position,
        division: prev?.division || fromRow.division,
        department: prev?.department || fromRow.department,
        positionType: prev?.positionType || fromRow.positionType,
      })
    })
    return Array.from(map.values())
      .map((e) => (e.weight !== undefined ? e : { ...e, weight: getPositionWeight(e.position) }))
      .sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
  }, [staffWithLabels, scheduleRows, getPositionWeight, unit])
  const operationalEmployeesFromSchedule = useMemo(
    () => allEmployeesFromSchedule.filter((emp) => isOperationalType(emp.positionType)),
    [allEmployeesFromSchedule],
  )

  const employeesFromSchedule = useMemo(() => {
    let list = [...allEmployeesFromSchedule]
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
    const query = String(filterQuery || '').toLowerCase().trim()
    if (query) {
      list = list.filter((e) => {
        const label = String(e.label || '').toLowerCase()
        const position = String(e.position || '').toLowerCase()
        return label.includes(query) || position.includes(query)
      })
    }
    list.sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label, 'ru'))
    return list
  }, [allEmployeesFromSchedule, pinnedEmployees, hiddenEmployees, positionFilter, filterQuery])

  const scheduleMap = useMemo(() => {
    const source = unit ? scheduleRows.filter((row) => row.unit === unit) : scheduleRows
    return new Map(source.map((row) => [`${row.employee_id}-${row.date}`, row]))
  }, [scheduleRows, unit])
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const scheduleByDay = useMemo(() => {
    const map = new Map()
    const source = unit ? scheduleRows.filter((row) => row.unit === unit) : scheduleRows
    source.forEach((row) => {
      const key = `${row.employee_id}-${row.date}`
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    })
    return map
  }, [scheduleRows, unit])
  const mergeEntriesForDate = useCallback(
    (employeeId, date, pending) => {
      const key = `${employeeId}-${date}`
      const base = scheduleByDay?.get ? scheduleByDay.get(key) || [] : []
      const extra = pending?.get ? pending.get(key) || [] : []
      return extra.length ? base.concat(extra) : base
    },
    [scheduleByDay],
  )
  const applyPendingToScheduleRows = useCallback((pending) => {
    if (!pending?.size) return
    setScheduleRows((prev) => {
      const byKey = new Map()
      prev.forEach((row) => {
        const key = `${row.employee_id}-${row.date}`
        const list = byKey.get(key) || []
        list.push(row)
        byKey.set(key, list)
      })
      pending.forEach((entries, key) => {
        byKey.set(key, Array.isArray(entries) ? entries : [])
      })
      return Array.from(byKey.values()).flat()
    })
  }, [])
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
      const hours = list
        .map((item) => {
          const raw = item?.planned_hours
          if (raw === null || raw === undefined || raw === '') return null
          const num = Number(raw)
          return Number.isFinite(num) ? num : null
        })
        .filter((n) => n !== null)
      const notes = list.map((i) => (i.note || '').toLowerCase())
      const has3 = hours.some((h) => Math.round(h) === 3)
      const has9 = hours.some((h) => Math.round(h) === 9)
      const hasMixNote = notes.some((n) => n.includes('9/3'))
      if ((has3 && has9) || hasMixNote) return 'night'
      const priority = ['sleep', 'night', 'special', 'learning', 'work', 'rest']
      for (const type of priority) {
        const found = list.some((item) => getIconType(item) === type)
        if (found) return type
      }
      return null
    },
    [],
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

    const nightHours = list
      .filter((i) => ['status-night', 'template-night'].includes(i?.source))
      .map((i) => Number(i?.planned_hours || 0))
      .filter((n) => Number.isFinite(n))

    const has3 = hours.some((h) => Math.round(h) === 3) || nightHours.some((h) => Math.round(h) === 3)
    const has9 = hours.some((h) => Math.round(h) === 9) || nightHours.some((h) => Math.round(h) === 9)
    if (has3 && has9) return '9/3'

    if (hours.length > 1) {
      const ordered = [...hours].sort((a, b) => b - a)
      return ordered.map((h) => String(h)).join('/')
    }
    if (hours.length === 1) {
      return `${hours[0]}`
    }
    return '—'
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

  const normalizedWorkplaces = useMemo(() => {
    return (workplaces || [])
      .map((wp, index) => {
        const code = String(wp.code || wp.workplace_code || wp.slug || wp.id || `wp-${index}`)
        const name = String(wp.name || wp.workplace_name || wp.title || wp.position_name || wp.position || code)
        const rawDivision =
          wp.devision_name ||
          wp.division_name ||
          wp.division ||
          wp.departament_id ||
          wp.departament_name ||
          wp.department_name ||
          wp.section ||
          ''
        const division = String(rawDivision || '').toLowerCase()
        const sort = Number(wp.sort_weight ?? wp.sort_order ?? wp.order_index ?? index)
        const rawPosition = wp.position_id || wp.position_name || wp.position || wp.allowed_position_name || ''
        const positionText = String(rawPosition || '').toLowerCase().trim()
        const allowedPositions = Array.isArray(wp.allowed_positions)
          ? wp.allowed_positions.map((n) => String(n || '').toLowerCase().trim()).filter(Boolean)
          : []
        const divisionKey = division.includes('котель')
          ? 'boiler'
          : division.includes('турбин')
            ? 'turbine'
            : 'other'
        return {
          id: code,
          name,
          divisionKey,
          sort: Number.isFinite(sort) ? sort : index,
          positionText,
          allowedPositions,
        }
      })
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'ru'))
  }, [workplaces])

  const normalizeRoleText = useCallback(
    (value) => normalizeRoleTextValue(value),
    [],
  )
  const splitRoleTokens = useCallback((value) => normalizeRoleText(value).split(' ').filter((t) => t.length > 2), [normalizeRoleText])
  const detectDivisionKey = useCallback(
    (emp) => {
      const raw = `${emp?.division || ''} ${emp?.department || ''} ${emp?.position || ''}`
      const lower = normalizeRoleText(raw)
      if (lower.includes('котел')) return 'boiler'
      if (lower.includes('турбин')) return 'turbine'
      return 'other'
    },
    [normalizeRoleText],
  )
  const canEmployeeCoverWorkplace = useCallback(
    (emp, workplace) => {
      const employeeText = normalizeRoleText(emp?.position)
      const workplaceText = normalizeRoleText(workplace?.positionText)
      if (!employeeText || !workplaceText) return false
      if (employeeText === workplaceText || employeeText.includes(workplaceText) || workplaceText.includes(employeeText)) return true
      const empTokens = splitRoleTokens(employeeText)
      const wpTokens = splitRoleTokens(workplaceText)
      const common = wpTokens.filter((t) => empTokens.some((e) => e === t || e.startsWith(t) || t.startsWith(e))).length
      if (common >= Math.max(2, Math.ceil(wpTokens.length * 0.6))) return true
      if (workplace.allowedPositions.some((name) => employeeText.includes(normalizeRoleText(name)))) return true
      const isSenior = employeeText.includes('старш') && employeeText.includes('машинист')
      const isLowerTarget =
        workplaceText.includes('щит') ||
        workplaceText.includes('обход') ||
        (workplaceText.includes('машинист') && !workplaceText.includes('старш'))
      if (isSenior && isLowerTarget) return true
      return false
    },
    [normalizeRoleText, splitRoleTokens],
  )
  const resolveEmployeesForShift = useCallback(
    (mode, targetDate, targetShiftType) => {
      const hasScheduleOnTargetDate = operationalEmployeesFromSchedule.some((emp) => {
        const entries = scheduleByDay.get(`${emp.id}-${targetDate}`) || []
        return entries.some((entry) => Number(entry?.planned_hours || 0) > 0)
      })
      if (!hasScheduleOnTargetDate) return []

      const slotKey = `${targetDate}|${targetShiftType}`
      const sessionIds = sessionEmployeeIdsBySlot[slotKey]
      if (mode === 'current' && Array.isArray(sessionIds) && sessionIds.length) {
        const sessionIdSet = new Set(sessionIds.map((id) => String(id)))
        const fromSession = operationalEmployeesFromSchedule.filter((emp) => sessionIdSet.has(String(emp.id)))
        if (fromSession.length) return fromSession
      }
      const byDayShiftHours = operationalEmployeesFromSchedule.filter((emp) => {
        const entries = scheduleByDay.get(`${emp.id}-${targetDate}`) || []
        const has12 = entries.some((entry) => Math.round(Number(entry?.planned_hours || 0)) === 12)
        const has3 = entries.some((entry) => Math.round(Number(entry?.planned_hours || 0)) === 3)
        const has9 = entries.some((entry) => Math.round(Number(entry?.planned_hours || 0)) === 9)
        return has12 && !has3 && !has9
      })
      const byNightShiftHours = operationalEmployeesFromSchedule.filter((emp) => {
        const entries = scheduleByDay.get(`${emp.id}-${targetDate}`) || []
        return entries.some((entry) => Math.round(Number(entry?.planned_hours || 0)) === 3)
      })
      return targetShiftType === 'night' ? byNightShiftHours : byDayShiftHours
    },
    [operationalEmployeesFromSchedule, scheduleByDay, sessionEmployeeIdsBySlot],
  )

  const buildShiftRoster = useCallback((mode, targetDate, targetShiftType) => {
    const roster = resolveEmployeesForShift(mode, targetDate, targetShiftType)
    const used = new Set()
    const assignForDivision = (divisionKey) => {
      const places = normalizedWorkplaces.filter((wp) => wp.divisionKey === divisionKey)
      const employees = roster.filter((emp) => {
        const key = detectDivisionKey(emp)
        if (divisionKey === 'other') return key === 'other'
        return key === divisionKey || key === 'other'
      })
      const rows = places.map((wp) => {
        const assigned = employees.find((emp) => !used.has(emp.id) && canEmployeeCoverWorkplace(emp, wp)) || null
        if (assigned) used.add(assigned.id)
        return {
          workplaceId: wp.id,
          workplaceName: wp.name,
          requiredPositionText: wp.positionText,
          divisionKey,
          employee: assigned,
        }
      })
      return rows
    }
    const chief = roster.find((emp) => isChiefPosition(emp.position)) || null
    return {
      chief,
      boiler: assignForDivision('boiler'),
      turbine: assignForDivision('turbine'),
      other: assignForDivision('other'),
    }
  }, [canEmployeeCoverWorkplace, detectDivisionKey, normalizedWorkplaces, resolveEmployeesForShift])

  const activeShiftCode = useMemo(
    () => shiftCodeForSlot(activeShiftDate, activeShiftType),
    [activeShiftDate, activeShiftType, shiftCodeForSlot],
  )
  const nextShiftType = nextShiftSlot.type
  const nextShiftDate = nextShiftSlot.date
  const nextShiftCode = useMemo(
    () => shiftCodeForSlot(nextShiftDate, nextShiftType),
    [nextShiftDate, nextShiftType, shiftCodeForSlot],
  )
  const operationalStaffPool = useMemo(
    () => allEmployeesFromSchedule.filter((emp) => isOperationalType(emp.positionType)),
    [allEmployeesFromSchedule],
  )
  const currentShiftEmployees = useMemo(
    () => resolveEmployeesForShift('current', activeShiftDate, activeShiftType),
    [activeShiftDate, activeShiftType, resolveEmployeesForShift],
  )
  const currentRoster = useMemo(
    () => buildShiftRoster('current', activeShiftDate, activeShiftType),
    [activeShiftDate, activeShiftType, buildShiftRoster],
  )
  const nextRoster = useMemo(
    () => buildShiftRoster('current', nextShiftDate, nextShiftType),
    [buildShiftRoster, nextShiftDate, nextShiftType],
  )
  const assignmentKey = useCallback(
    (date, shiftType, workplaceId) => `${date}|${shiftType}|${workplaceId}`,
    [],
  )
  const getPreviousShiftSlot = useCallback(
    (date, shiftType) => {
      if (shiftType === 'night') return { date, shiftType: 'day' }
      return { date: addDaysIso(date, -1), shiftType: 'night' }
    },
    [addDaysIso],
  )
  const getCandidatesForWorkplace = useCallback(
    (row) => {
      const requiredWeight = getPositionWeight(row.requiredPositionText || row.workplaceName || '')
      const byDivision = (pool) =>
        pool.filter((emp) => {
          const divisionKey = detectDivisionKey(emp)
          if (row.divisionKey === 'other') return divisionKey === 'other'
          return divisionKey === row.divisionKey || divisionKey === 'other'
        })
      const byWorkplaceAndRank = (pool) =>
        byDivision(pool).filter((emp) => {
          const isChief = isChiefPosition(emp.position)
          const workplaceIsChief = isChiefPosition(row.requiredPositionText || row.workplaceName)
          if (isChief && !workplaceIsChief && pool === currentShiftEmployees) return false
          const rankOk = requiredWeight >= 900 || (Number.isFinite(emp.weight) ? emp.weight <= requiredWeight : true)
          if (!rankOk) return false
          return canEmployeeCoverWorkplace(emp, {
            positionText: row.requiredPositionText,
            allowedPositions: [],
          })
        })
      const primary = byWorkplaceAndRank(currentShiftEmployees)
      const all = byWorkplaceAndRank(operationalStaffPool)
      const primaryIds = new Set(primary.map((emp) => String(emp.id)))
      const extra = all.filter((emp) => !primaryIds.has(String(emp.id)))
      return { primary, extra }
    },
    [canEmployeeCoverWorkplace, currentShiftEmployees, detectDivisionKey, getPositionWeight, operationalStaffPool],
  )
  const chiefCandidates = useMemo(() => {
    const fromCurrent = currentShiftEmployees.filter((emp) => isChiefPosition(emp.position))
    const fromAll = operationalStaffPool.filter((emp) => isChiefPosition(emp.position))
    const map = new Map()
    ;[...fromCurrent, ...fromAll].forEach((emp) => map.set(String(emp.id), emp))
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [currentShiftEmployees, operationalStaffPool])
  const resolvedChief = useMemo(() => {
    const key = assignmentKey(activeShiftDate, activeShiftType, 'chief')
    const manual = String(manualChiefAssignments[key] || '')
    if (manual) {
      const found = chiefCandidates.find((emp) => String(emp.id) === manual)
      if (found) return found
    }
    return currentRoster.chief || chiefCandidates[0] || null
  }, [activeShiftDate, activeShiftType, assignmentKey, chiefCandidates, currentRoster.chief, manualChiefAssignments])
  const resolvedCurrentRoster = useMemo(() => {
    const rows = [...(currentRoster.boiler || []), ...(currentRoster.turbine || [])]
    const used = new Set()
    const byId = new Map([...currentShiftEmployees, ...operationalStaffPool].map((emp) => [String(emp.id), emp]))
    const prevSlot = getPreviousShiftSlot(activeShiftDate, activeShiftType)
    const pickFallbackId = (row, candidates) => {
      const previousKey = assignmentKey(prevSlot.date, prevSlot.shiftType, row.workplaceId)
      const previousId = manualWorkplaceAssignments[previousKey]
      const autoId = row.employee?.id ? String(row.employee.id) : ''
      const queue = [previousId, autoId].filter(Boolean).map(String)
      const candidateIds = new Set(candidates.map((c) => String(c.id)))
      const preferred = queue.find((id) => candidateIds.has(id) && !used.has(id))
      if (preferred) return preferred
      const fallback = candidates.find((c) => !used.has(String(c.id)))
      return fallback ? String(fallback.id) : ''
    }
    const rowsWithCandidates = rows.map((row) => ({
      ...row,
      candidates: getCandidatesForWorkplace(row).primary,
      extraCandidates: getCandidatesForWorkplace(row).extra,
      allCandidates: [...getCandidatesForWorkplace(row).primary, ...getCandidatesForWorkplace(row).extra],
    }))
    const resolvedByWorkplaceId = new Map()

    // Pass 1: strict manual override for current slot (always highest priority)
    rowsWithCandidates.forEach((row) => {
      const currentKey = assignmentKey(activeShiftDate, activeShiftType, row.workplaceId)
      const manualId = String(manualWorkplaceAssignments[currentKey] || '')
      if (!manualId) return
      const isAllowed = row.allCandidates.some((c) => String(c.id) === manualId)
      if (!isAllowed || used.has(manualId)) return
      used.add(manualId)
      resolvedByWorkplaceId.set(row.workplaceId, manualId)
    })

    // Pass 2: previous slot / auto / free candidate
    rowsWithCandidates.forEach((row) => {
      if (resolvedByWorkplaceId.has(row.workplaceId)) return
      const selectedId = pickFallbackId(row, row.candidates)
      if (!selectedId) return
      used.add(selectedId)
      resolvedByWorkplaceId.set(row.workplaceId, selectedId)
    })

    const resolvedRows = rowsWithCandidates.map((row) => {
      const selectedId = resolvedByWorkplaceId.get(row.workplaceId) || ''
      const candidateSets = getCandidatesForWorkplace(row)
      return {
        ...row,
        candidates: candidateSets.primary,
        extraCandidates: candidateSets.extra,
        selectedEmployee: selectedId ? byId.get(selectedId) || null : null,
      }
    })
    return {
      boiler: resolvedRows.filter((r) => r.divisionKey === 'boiler'),
      turbine: resolvedRows.filter((r) => r.divisionKey === 'turbine'),
    }
  }, [
    activeShiftDate,
    activeShiftType,
    assignmentKey,
    currentRoster.boiler,
    currentRoster.turbine,
    currentShiftEmployees,
    getCandidatesForWorkplace,
    getPreviousShiftSlot,
    manualWorkplaceAssignments,
    operationalStaffPool,
  ])

  useEffect(() => {
    if (section !== 'personnel' || !unit || !user) return
    const timer = setTimeout(async () => {
      const sessionRes = await handoverService.fetchSession({
        unit,
        shiftDate: activeShiftDate,
        shiftType: activeShiftType,
      })
      if (sessionRes.error || !sessionRes.data?.id) {
        setAssignmentSessionId(null)
        setSessionEmployeeIdsBySlot((prev) => {
          const next = { ...prev }
          delete next[`${activeShiftDate}|${activeShiftType}`]
          return next
        })
        return
      }
      setAssignmentSessionId(sessionRes.data.id)
      const chiefKey = assignmentKey(activeShiftDate, activeShiftType, 'chief')
      if (sessionRes.data?.chief_employee_id) {
        setManualChiefAssignments((prev) => ({ ...prev, [chiefKey]: String(sessionRes.data.chief_employee_id) }))
      }
      const assignmentsRes = await handoverService.fetchAssignments({ sessionId: sessionRes.data.id })
      if (assignmentsRes.error) return
      const slotPrefix = `${activeShiftDate}|${activeShiftType}|`
      const nextMap = {}
      const presentEmployeeIds = []
      ;(assignmentsRes.data || []).forEach((row) => {
        const wpCode = row.workplace_code
        const empId = row.employee_id
        if (!wpCode || !empId) return
        if (row.is_present !== false) presentEmployeeIds.push(String(empId))
        nextMap[`${slotPrefix}${wpCode}`] = String(empId)
      })
      setManualWorkplaceAssignments((prev) => {
        const merged = { ...prev }
        Object.keys(merged).forEach((k) => {
          if (k.startsWith(slotPrefix)) delete merged[k]
        })
        return { ...merged, ...nextMap }
      })
      setSessionEmployeeIdsBySlot((prev) => ({
        ...prev,
        [`${activeShiftDate}|${activeShiftType}`]: Array.from(new Set(presentEmployeeIds)),
      }))
    }, 0)
    return () => clearTimeout(timer)
  }, [activeShiftDate, activeShiftType, assignmentKey, handoverService, section, unit, user])

  const handleSaveWorkplaceAssignments = useCallback(async ({ quiet = false } = {}) => {
    if (!user || section !== 'personnel' || !unit) return
    setSavingWorkplaces(true)
    if (!quiet) {
      setWorkplaceSaveError('')
      setWorkplaceSaveMessage('')
    }

    let sessionId = assignmentSessionId
    if (!sessionId) {
      const createRes = await shiftWorkflowService.createOrGetBriefing({
        date: activeShiftDate,
        unit,
        shiftType: activeShiftType,
      })
      if (createRes.error || !createRes.data) {
        if (!quiet) setWorkplaceSaveError(createRes.error?.message || 'Не удалось создать сессию смены')
        setSavingWorkplaces(false)
        return null
      }
      sessionId = createRes.data
      setAssignmentSessionId(sessionId)
    }

    const allRows = [...(resolvedCurrentRoster.boiler || []), ...(resolvedCurrentRoster.turbine || [])]
    const assignedByEmployee = new Map()
    allRows.forEach((row) => {
      if (!row.selectedEmployee?.id) return
      assignedByEmployee.set(String(row.selectedEmployee.id), row)
    })
    const chiefEmployeeId = resolvedChief?.id ? String(resolvedChief.id) : ''
    const employeePool = new Map(currentShiftEmployees.map((emp) => [String(emp.id), emp]))
    operationalStaffPool.forEach((emp) => employeePool.set(String(emp.id), emp))
    const includedEmployeeIds = new Set([...assignedByEmployee.keys(), ...currentShiftEmployees.map((emp) => String(emp.id))])
    if (chiefEmployeeId) includedEmployeeIds.add(chiefEmployeeId)

    const payload = Array.from(includedEmployeeIds).map((id) => {
      const emp = employeePool.get(String(id))
      if (!emp) return null
      const assigned = assignedByEmployee.get(String(emp.id))
      const isChief = chiefEmployeeId && String(emp.id) === chiefEmployeeId
      const isInCurrentShift = currentShiftEmployees.some((shiftEmp) => String(shiftEmp.id) === String(emp.id))
      const isPresent = Boolean(assigned || isChief || isInCurrentShift)
      return {
        session_id: sessionId,
        employee_id: emp.id,
        workplace_code: assigned ? String(assigned.workplaceId) : 'general',
        position_name: emp.position || null,
        source: assigned || !isInCurrentShift || isChief ? 'manual' : 'schedule',
        is_present: isPresent,
        note: null,
        confirmed_by_chief: false,
      }
    }).filter(Boolean)

    if (chiefEmployeeId) {
      await handoverService.updateSession({
        sessionId,
        payload: { chief_employee_id: Number(chiefEmployeeId) },
      })
    }

    const saveRes = await handoverService.upsertAssignments(payload)
    if (saveRes.error) {
      if (!quiet) setWorkplaceSaveError(saveRes.error.message || 'Не удалось сохранить расстановку')
      setSavingWorkplaces(false)
      return null
    }
    setSavingWorkplaces(false)
    if (!quiet) setWorkplaceSaveMessage('Расстановка сохранена')
    return sessionId
  }, [
    activeShiftDate,
    activeShiftType,
    assignmentSessionId,
    currentShiftEmployees,
    handoverService,
    operationalStaffPool,
    resolvedCurrentRoster.boiler,
    resolvedCurrentRoster.turbine,
    resolvedChief,
    section,
    shiftWorkflowService,
    unit,
    user,
  ])

  const handleConfirmWorkplaceAssignments = async () => {
    if (!user || section !== 'personnel' || !unit) return
    setConfirmingWorkplaces(true)
    setWorkplaceSaveError('')
    setWorkplaceSaveMessage('')
    const sessionId = await handleSaveWorkplaceAssignments({ quiet: true })
    if (!sessionId) {
      setConfirmingWorkplaces(false)
      setWorkplaceSaveError('Не удалось сохранить расстановку перед подтверждением')
      return
    }
    const confirmRes = await shiftWorkflowService.confirmBriefing({ briefingId: sessionId })
    if (confirmRes.error) {
      setConfirmingWorkplaces(false)
      setWorkplaceSaveError(confirmRes.error.message || 'Не удалось подтвердить смену')
      return
    }
    const selectedIds = new Set(
      [...(resolvedCurrentRoster.boiler || []), ...(resolvedCurrentRoster.turbine || [])]
        .map((row) => row.selectedEmployee?.id)
        .filter(Boolean)
        .map((id) => String(id)),
    )
    if (resolvedChief?.id) selectedIds.add(String(resolvedChief.id))
    const assignedList = Array.from(selectedIds)
    if (assignedList.length) {
      const shifts = activeShiftType === 'night'
        ? [
            { date: activeShiftDate, start_time: '20:00:00', end_time: '23:00:00', planned_hours: 3, note: 'Подмена (ночь, часть 1)' },
            { date: addDaysIso(activeShiftDate, 1), start_time: '00:00:00', end_time: '09:00:00', planned_hours: 9, note: 'Подмена (ночь, часть 2)' },
          ]
        : [
            { date: activeShiftDate, start_time: '08:00:00', end_time: '20:00:00', planned_hours: 12, note: 'Подмена (дневная смена)' },
          ]
      await Promise.all(
        assignedList.flatMap((employeeId) =>
          shifts.map((shift) =>
            scheduleService.createEntry({
              employee_id: Number(employeeId),
              date: shift.date,
              start_time: shift.start_time,
              end_time: shift.end_time,
              planned_hours: shift.planned_hours,
              unit,
              created_by: user.id,
              source: 'manual-assignment',
              note: shift.note,
            }),
          ),
        ),
      )
      void loadSchedule({ silent: true })
    }
    setConfirmingWorkplaces(false)
    setWorkplaceSaveMessage('Смена принята, персонал проинструктирован. Календарь обновлен по подтвержденному составу.')
  }

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
    const timer = setTimeout(() => {
      void loadSchedule()
    }, 0)
    return () => clearTimeout(timer)
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
      query: null,
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
  }, [scheduleService, section, user, filterCategory, filterSection, positionFilter, positionsList])

  const loadShiftTemplates = useCallback(async () => {
    const { data, error } = await scheduleService.fetchShiftTemplates()
    if (!error) setShiftTemplates(data || [])
  }, [scheduleService])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStaff()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadStaff])

  useEffect(() => {
    const loadPositions = async () => {
      const { data, error } = await scheduleService.fetchPositions()
      if (!error) setPositionsList(data || [])
    }
    loadPositions()
  }, [scheduleService])

  useEffect(() => {
    if (!unit || section !== 'personnel' || !user) return
    const timer = setTimeout(async () => {
      const { data, error } = await scheduleService.fetchWorkplaces({ unit })
      if (!error) setWorkplaces(data || [])
    }, 0)
    return () => clearTimeout(timer)
  }, [scheduleService, section, unit, user])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShiftTemplates()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadShiftTemplates])

  const loadCurrentShiftPermissions = useCallback(async () => {
    if (!unit || !user || !profile?.employee?.id) {
      setActiveShiftPermissions([])
      return
    }
    const sessionRes = await handoverService.fetchSession({
      unit,
      shiftDate: currentShiftDate,
      shiftType: currentShiftType,
    })
    if (sessionRes.error || !sessionRes.data?.id) {
      setActiveShiftPermissions([])
      return
    }
    const permsRes = await handoverService.fetchActivePermissions({
      sessionId: sessionRes.data.id,
      employeeId: profile.employee.id,
    })
    setActiveShiftPermissions(permsRes.error ? [] : (permsRes.data || []))
  }, [currentShiftDate, currentShiftType, handoverService, profile, unit, user])

  useEffect(() => {
    if (section !== 'docs' || unit !== 'ktc' || !user) return
    const timer = setTimeout(() => {
      void loadCurrentShiftPermissions()
    }, 0)
    return () => clearTimeout(timer)
  }, [section, unit, user, loadCurrentShiftPermissions])

  const handleCreate = async () => {
    if (!newEntry.title.trim()) {
      setEntriesError('Введите заголовок')
      return
    }
    if (!user) {
      return
    }
    if (!canCreateEntryByShift) {
      const requiredScope = scopeForEntryType(newEntry.type)
      const scopeName =
        requiredScope === 'daily_statement'
          ? 'суточная ведомость'
          : requiredScope === 'operational_log'
            ? 'оперативный журнал'
            : 'управление сменой'
      setEntriesError(`Нет права на запись: требуется активное назначение на "${scopeName}" после подтверждения начальником смены.`)
      return
    }
    await createEntry({
      type: newEntry.type,
      title: newEntry.title,
      body: newEntry.body,
      unit: unit || null,
      created_by_employee_id: profile?.employee?.id || null,
      author_snapshot: authorLabel ? { label: authorLabel } : null,
    })
    setNewEntry({ type: newEntry.type, title: '', body: '' })
  }

  const handleAcknowledge = async (entryId) => {
    if (!user) return
    await acknowledgeEntry(entryId)
  }

  const handleRefresh = async () => {
    await refreshEntries()
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllRead()
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
    const pending = opts.pending ?? new Map()
    const isBatch = Boolean(opts.pending)
    const skipReload = opts.skipReload
    if (!shiftId) return
    if (shiftId === 'clear') {
      await deleteNightParts(employeeId, [date], pending)
      await scheduleService.deleteEntry({ employeeId: Number(employeeId), date })
      pending.set(`${employeeId}-${date}`, [])
      if (!isBatch) applyPendingToScheduleRows(pending)
      if (!skipReload) void loadSchedule({ silent: true })
      return
    }
    if (shiftId === 'off') {
      await deleteNightParts(employeeId, [date], pending)
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
      pending.set(`${employeeId}-${date}`, [payload])
      if (!isBatch) applyPendingToScheduleRows(pending)
      if (!skipReload) void loadSchedule({ silent: true })
      return
    }

    const custom = customShiftMap[shiftId]
    // Если ставим любую смену кроме ночной — уберём ночные хвосты на день и следующий
    if (shiftId !== 'night12') {
      await deleteNightParts(employeeId, [date, addDays(date, 1)], pending)
    }
    if (custom) {
      // Спец-логика для ночной 3/9
      if (shiftId === 'night12') {
        const existingList = mergeEntriesForDate(employeeId, date, pending)
        const tailFromPrev = existingList.find(
          (item) => ['status-night', 'template-night'].includes(item?.source) && Number(item.planned_hours || 0) >= 9,
        )
        const hasTailFromPrev = Boolean(tailFromPrev)
        const dayOneHours = clampPositiveHours(3)
        const dayTwoHours = clampPositiveHours((custom.hours || 12) - 3)
        const nextDate = addDays(date, 1)
        // чистим будущий хвост, но если есть хвост 9ч с предыдущей ночи — не трогаем его
        await deleteNightParts(employeeId, [nextDate], pending)

        if (hasTailFromPrev) {
          const updatedToday = {
            employee_id: Number(employeeId),
            date,
            start_time: tailFromPrev.start_time ?? null,
            end_time: tailFromPrev.end_time ?? null,
            planned_hours: clampPositiveHours((Number(tailFromPrev.planned_hours) || 0) + dayOneHours),
            unit: unit,
            created_by: user.id,
            source: tailFromPrev.source || 'status-night',
            template_id: tailFromPrev.template_id ?? null,
            note: 'Ночная (9/3, подряд)',
          }
          await scheduleService.createEntry(updatedToday)
          const key = `${employeeId}-${date}`
          pending.set(key, [updatedToday])
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
          const key = `${employeeId}-${date}`
          const list = mergeEntriesForDate(employeeId, date, pending).filter((e) => e !== entryToday)
          pending.set(key, [...list.filter((e) => e.source !== 'status-night'), entryToday])
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
        const keyNext = `${employeeId}-${nextDate}`
        pending.set(keyNext, [...mergeEntriesForDate(employeeId, nextDate, pending).filter((e) => e !== entryNext), entryNext])
        if (!isBatch) applyPendingToScheduleRows(pending)
        if (!skipReload) void loadSchedule({ silent: true })
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
      const key = `${employeeId}-${date}`
      pending.set(key, [...mergeEntriesForDate(employeeId, date, pending), { ...payload, source: 'status' }])
      if (!isBatch) applyPendingToScheduleRows(pending)
      if (!skipReload) void loadSchedule({ silent: true })
      return
    }

    const tmpl = shiftTemplateMap[shiftId]
    if (!tmpl) return
    if (isNightSplitTemplate(tmpl)) {
      const existingList = mergeEntriesForDate(employeeId, date, pending)
      const tailFromPrev = existingList.find(
        (item) => ['status-night', 'template-night'].includes(item?.source) && Number(item.planned_hours || 0) >= 9,
      )
      const hasTailFromPrev = Boolean(tailFromPrev)
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
            planned_hours: clampPositiveHours((Number(tailFromPrev.planned_hours) || 0) + dayOneHours),
            unit: unit,
            created_by: user.id,
            source: 'template-night',
            template_id: tmpl.id,
            note: `${baseNote} (9/3, подряд)`,
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
      const key = `${employeeId}-${date}`
      if (hasTailFromPrev) {
        pending.set(key, [entryToday])
      } else {
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
      const keyNext = `${employeeId}-${nextDate}`
      pending.set(keyNext, [...mergeEntriesForDate(employeeId, nextDate, pending).filter((e) => e !== entryNext), entryNext])
      if (!isBatch) applyPendingToScheduleRows(pending)
      if (!skipReload) void loadSchedule({ silent: true })
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
    const key = `${employeeId}-${date}`
    pending.set(key, [...mergeEntriesForDate(employeeId, date, pending), { ...payload, source: tmpl.code || 'template' }])
    if (!isBatch) applyPendingToScheduleRows(pending)
    if (!skipReload) void loadSchedule({ silent: true })
  }

  const applyShiftToSelected = async (shiftId) => {
    if (!shiftId || !selectedCells.length) return
    setSelectedShiftId(shiftId)
    setMenuCell(null)
    const unique = new Map()
    selectedCells.forEach((c) => unique.set(`${c.employeeId}-${c.date}`, c))
    setSelectedCells([])
    setSelectionAnchor(null)
    const tasks = Array.from(unique.values()).map((cell) =>
      handleApplyShift(cell.employeeId, cell.date, shiftId, { skipReload: true }),
    )
    void Promise.allSettled(tasks).then(() => {
      void loadSchedule({ silent: true })
    })
  }

  const renderRosterColumn = useCallback((title, rows, editable = false) => {
    return (
      <div className="rounded-xl border border-border bg-background/70 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">{title}</p>
        <div className="mt-2 space-y-2">
          {rows.map((row) => {
            const key = assignmentKey(activeShiftDate, activeShiftType, row.workplaceId)
            const candidates = row.candidates || []
            const extraCandidates = row.extraCandidates || []
            const isExpanded = Boolean(expandedWorkplaceSelects[key])
            const selectedEmployee = row.selectedEmployee || null
            const selectedInPrimary = selectedEmployee ? candidates.some((emp) => String(emp.id) === String(selectedEmployee.id)) : false
            return (
              <div key={row.workplaceId}>
                <p className="text-[11px] text-grayText">{row.workplaceName}</p>
                {editable ? (
                  <div className="mt-1">
                    <select
                      value={selectedEmployee?.id ? String(selectedEmployee.id) : ''}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        if (nextValue === '__more__') {
                          setExpandedWorkplaceSelects((prev) => ({ ...prev, [key]: true }))
                          return
                        }
                        setManualWorkplaceAssignments((prev) => {
                          const next = { ...prev }
                          if (!nextValue) delete next[key]
                          else {
                            const slotPrefix = `${activeShiftDate}|${activeShiftType}|`
                            Object.keys(next).forEach((k) => {
                              if (k !== key && k.startsWith(slotPrefix) && String(next[k]) === String(nextValue)) {
                                delete next[k]
                              }
                            })
                            next[key] = nextValue
                          }
                          return next
                        })
                      }}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-dark"
                    >
                      <option value="">—</option>
                      {selectedEmployee && !selectedInPrimary && (
                        <option value={selectedEmployee.id}>{selectedEmployee.label}</option>
                      )}
                      {candidates.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.label}
                        </option>
                      ))}
                      {!isExpanded && extraCandidates.length > 0 && <option value="__more__">Еще…</option>}
                      {isExpanded &&
                        extraCandidates.map((emp) => (
                          <option key={`extra-${emp.id}`} value={emp.id}>
                            {emp.label}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-dark">{row.employee?.label || '—'}</p>
                )}
              </div>
            )
          })}
          {!rows.length && <p className="text-xs text-grayText">Нет рабочих мест в таблице `workplace`.</p>}
        </div>
      </div>
    )
  }, [
    activeShiftDate,
    activeShiftType,
    assignmentKey,
    expandedWorkplaceSelects,
  ])

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
      {section !== 'personnel' && (
        <div
          className={`overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${bg} p-6 shadow-xl shadow-sky-900/10 sm:p-8`}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
            {unitData.name} · {sectionLabel}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{headerTitle}</h1>
        </div>
      )}

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
                disabled={saving || !canCreateEntryByShift}
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
            {section === 'docs' && unit === 'ktc' && (
              <p className="mt-2 text-[11px] text-slate-400">
                Активные права на смене: {activeShiftPermissions.map((p) => p.scope).join(', ') || 'нет'}.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                  <div className="flex flex-col gap-1 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>#{item.id}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    Автор: {item.author_snapshot?.label || item.author_name || '—'} {item.unit ? `· ${item.unit}` : ''}
                    {item.type ? ` · ${item.type}` : ''}
                  </p>
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap">
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
          <div className="rounded-2xl border border-border bg-surface/95 p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-grayText">На смене</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-grayText">
                  <span>Начальник смены:</span>
                  <select
                    value={resolvedChief?.id ? String(resolvedChief.id) : ''}
                    onChange={(e) => {
                      const key = assignmentKey(activeShiftDate, activeShiftType, 'chief')
                      const value = String(e.target.value || '')
                      setManualChiefAssignments((prev) => {
                        const next = { ...prev }
                        if (!value) delete next[key]
                        else next[key] = value
                        return next
                      })
                    }}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-dark"
                  >
                    <option value="">—</option>
                    {chiefCandidates.map((emp) => (
                      <option key={`chief-${emp.id}`} value={emp.id}>
                        {emp.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewedShiftOffset((prev) => prev - 1)}
                  className="no-spy-btn rounded-full border border-border px-3 py-1 text-sm text-dark transition hover:border-accent/60"
                >
                  ←
                </button>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
                  {new Date(activeShiftDate).toLocaleDateString('ru-RU')} · Вахта {activeShiftCode} · {shiftSlotTypeLabel(activeShiftType)}
                </span>
                <button
                  onClick={() => setViewedShiftOffset((prev) => prev + 1)}
                  className="no-spy-btn rounded-full border border-border px-3 py-1 text-sm text-dark transition hover:border-accent/60"
                >
                  →
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {renderRosterColumn('Котельное', resolvedCurrentRoster.boiler, true)}
              {renderRosterColumn('Турбинное', resolvedCurrentRoster.turbine, true)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link to="/shift/briefing" className="rounded-full border border-border px-3 py-1 text-xs text-dark hover:border-accent/60">
                Инструктаж
              </Link>
              <Link to="/rounds/today" className="rounded-full border border-border px-3 py-1 text-xs text-dark hover:border-accent/60">
                Сегодняшний обход
              </Link>
              <button
                onClick={() => void handleConfirmWorkplaceAssignments()}
                disabled={savingWorkplaces || confirmingWorkplaces}
                className="rounded-full bg-eco px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {confirmingWorkplaces || savingWorkplaces ? 'Подтверждаем...' : 'Подтвердить смену (инструктаж проведен)'}
              </button>
              {assignmentSessionId && <span className="text-xs text-grayText">Сессия: {assignmentSessionId}</span>}
              {workplaceSaveMessage && <span className="text-xs text-eco">{workplaceSaveMessage}</span>}
              {workplaceSaveError && <span className="text-xs text-red-300">{workplaceSaveError}</span>}
            </div>
            <div className="mt-3 rounded-xl border border-border bg-background/70 p-3 text-xs">
              <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Смену принимает</p>
              <p className="mt-1 text-dark">
                {new Date(nextShiftDate).toLocaleDateString('ru-RU')} · Вахта {nextShiftCode} · {shiftSlotTypeLabel(nextShiftType)} · Начальник: {nextRoster.chief?.label || 'не назначен'}
              </p>
              <p className="mt-1 text-grayText">
                Рабочих мест к приёмке: {(nextRoster.boiler?.length || 0) + (nextRoster.turbine?.length || 0)}.
              </p>
            </div>
          </div>

          {!showSchedule ? (
            <button
              type="button"
              onClick={() => setShowSchedule(true)}
              className="group relative w-full overflow-hidden rounded-3xl border border-accent/45 bg-gradient-to-br from-slate-900 via-[#0f1e18] to-slate-950 p-6 text-left shadow-[0_12px_40px_-14px_rgba(31,107,67,0.5)] transition hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-[0_20px_52px_-14px_rgba(31,107,67,0.62)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
            >
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(62,219,138,0.2),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(31,107,67,0.28),transparent_42%)]" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="mt-1 text-2xl font-semibold text-white">ГРАФИК</h3>
                    <p className="mt-1 text-sm text-gray-200/90">Открыть календарь смен персонала.</p>
                  </div>
                  <span className="rounded-full border border-warning/60 bg-warning-light px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
                    Тестирование
                  </span>
                </div>
            </button>
          ) : (
            <>
              <PersonnelSchedule
                monthDates={monthDates}
                monthLabel={monthLabel}
                employeesFromSchedule={employeesFromSchedule}
                filterCategory={filterCategory}
                filterSection={filterSection}
                filterQuery={filterQuery}
                filterQueryInput={filterQueryInput}
                unitCode={unit}
                positionFilter={positionFilter}
                positionOptions={positionOptions}
                positionsOpen={positionsOpen}
                setFilterCategory={setFilterCategory}
                setFilterSection={setFilterSection}
                setFilterQuery={setFilterQuery}
                setFilterQueryInput={setFilterQueryInput}
                setPositionFilter={setPositionFilter}
                setPositionsOpen={setPositionsOpen}
                resetFilters={resetFilters}
                pinnedEmployees={pinnedEmployees}
                hiddenEmployees={hiddenEmployees}
                setPinnedEmployees={setPinnedEmployees}
                setHiddenEmployees={setHiddenEmployees}
                collapsedPositions={collapsedPositions}
                setCollapsedPositions={setCollapsedPositions}
                scheduleError={scheduleError}
                loadingSchedule={loadingSchedule}
                loadingStaff={loadingStaff}
                staffError={staffError}
                monthStart={monthStart}
                setMonthStart={setMonthStart}
                groupedByPosition={groupedByPosition}
                selectedEmployeeIds={selectedEmployeeIds}
                setSelectedEmployeeIds={setSelectedEmployeeIds}
                scheduleByDay={scheduleByDay}
                formatCellValue={formatCellValue}
                resolveIconType={resolveIconType}
                iconCatalog={iconCatalog}
                monthNorm={monthNorm}
                selectedCell={selectedCell}
                selectedCells={selectedCells}
                setSelectedCells={setSelectedCells}
                handleCellClick={handleCellClick}
                handleApplyShift={handleApplyShift}
                applyShiftToSelected={applyShiftToSelected}
                setSelectionAnchor={setSelectionAnchor}
                setMenuCell={setMenuCell}
                menuCell={menuCell}
                shiftMenuPosition={shiftMenuPosition}
                shiftOptions={shiftOptions}
                pentagramTypesInSchedule={pentagramTypesInSchedule}
                isPersonnel
                ShiftIcon={ShiftIcon}
                onBackToCard={() => setShowSchedule(false)}
              />
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200 shadow-lg">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Следующие шаги</p>
        <ul className="mt-3 space-y-2">
          {section === 'personnel' && (
            <>
              <li>• Добавить возможность экспорта в файл</li>
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
