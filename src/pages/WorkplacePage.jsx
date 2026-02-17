import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
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

const normalizeRoleText = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const isChiefWorkplace = (workplace) => {
  const text = normalizeRoleText([workplace?.name, workplace?.code, workplace?.position_name, workplace?.position].filter(Boolean).join(' '))
  return text.includes('начальник смен') || text.includes('нс ктц') || text.includes('нсктц')
}
const isChiefPosition = (value) => {
  const text = normalizeRoleText(value)
  return text.includes('начальник смен') || text.includes('нс ктц') || text.includes('нсктц')
}
const isReserveWorkplace = (workplace) => {
  const text = normalizeRoleText([workplace?.name, workplace?.code, workplace?.section, workplace?.area].filter(Boolean).join(' '))
  return text.includes('резерв') || text.includes('без пост')
}
const workplaceDivisionKey = (workplace) => {
  const text = normalizeRoleText(
    [
      workplace?.name,
      workplace?.code,
      workplace?.section,
      workplace?.area,
      workplace?.division_name,
      workplace?.devision_name,
      workplace?.department_name,
      workplace?.departament_name,
      workplace?.position_name,
      workplace?.position,
    ]
      .filter(Boolean)
      .join(' '),
  )
  if (text.includes('котел') || text.includes('котель') || text.includes('ко ') || text.endsWith('ко') || text.includes('цтщупк')) return 'boiler'
  if (text.includes('турбин') || text.includes('то ') || text.endsWith('то') || text.includes('цтщупт')) return 'turbine'
  return 'other'
}
const employeeDivisionKey = (positionName) => {
  const text = normalizeRoleText(positionName)
  if (text.includes('котел') || text.includes('котель') || text.includes('ко ') || text.endsWith('ко') || text.includes('цтщупк')) return 'boiler'
  if (text.includes('турбин') || text.includes('то ') || text.endsWith('то') || text.includes('цтщупт')) return 'turbine'
  return 'other'
}

const compactControlPoint = (value) =>
  normalizeKey(value)
    .replace(/\s+/g, '')
    .replace(/_/g, '')

const normalizeStationValue = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const SHIFT_ANCHOR_DATE = '2026-02-09' // day shift = А
const SHIFT_CODES = ['А', 'Б', 'В', 'Г']
const SHIFT_TIME_ZONE = 'Asia/Irkutsk'
const shiftNowFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHIFT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

const parseIsoLocalDate = (dateStr) => {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map((v) => Number(v))
  return new Date(y, (m || 1) - 1, d || 1)
}

const getShiftCodeByDate = (dateStr, shiftType) => {
  const diffMs = parseIsoLocalDate(dateStr).getTime() - parseIsoLocalDate(SHIFT_ANCHOR_DATE).getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const dayIndex = ((diffDays % SHIFT_CODES.length) + SHIFT_CODES.length) % SHIFT_CODES.length
  const index = shiftType === 'night' ? ((dayIndex - 1 + SHIFT_CODES.length) % SHIFT_CODES.length) : dayIndex
  return SHIFT_CODES[index] || '—'
}

const getCurrentShiftSlot = () => {
  const parts = shiftNowFormatter.formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value || '1970'
  const month = parts.find((p) => p.type === 'month')?.value || '01'
  const day = parts.find((p) => p.type === 'day')?.value || '01'
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0')
  const today = `${year}-${month}-${day}`
  const type = hour >= 21 || hour < 9 ? 'night' : 'day'
  const date = type === 'night' && hour < 9 ? addDays(today, -1) : today
  return { date, type }
}

const shiftPeriodLabel = (type) => (type === 'night' ? '21:00–09:00' : '09:00–21:00')
const shiftTypeRank = (type) => (type === 'night' ? 1 : 0)
const compareShiftSlots = (aDate, aType, bDate, bType) => {
  const aTime = parseIsoLocalDate(aDate).getTime()
  const bTime = parseIsoLocalDate(bDate).getTime()
  if (aTime !== bTime) return aTime - bTime
  return shiftTypeRank(aType) - shiftTypeRank(bType)
}
const moveShiftSlot = (dateStr, shiftType, direction) => {
  if (direction > 0) {
    if (shiftType === 'day') return { date: dateStr, type: 'night' }
    return { date: addDays(dateStr, 1), type: 'day' }
  }
  if (shiftType === 'night') return { date: dateStr, type: 'day' }
  return { date: addDays(dateStr, -1), type: 'night' }
}

const hasTag = (tags, value) => (Array.isArray(tags) ? tags : []).includes(value)

const FACT_STATUS_OPTIONS = [
  { value: 'full', label: 'Полная смена' },
  { value: 'late', label: 'Опоздал' },
  { value: 'left_early', label: 'Ушел раньше' },
  { value: 'partial', label: 'Неполная смена' },
  { value: 'replaced', label: 'Подменен' },
  { value: 'absent', label: 'Отсутствовал' },
]
const FACT_STATUS_SET = new Set(FACT_STATUS_OPTIONS.map((item) => item.value))
const FACT_STATUS_LABELS = Object.fromEntries(FACT_STATUS_OPTIONS.map((item) => [item.value, item.label]))

const normalizeFactStatus = (value) => {
  const key = String(value || '').trim().toLowerCase()
  return FACT_STATUS_SET.has(key) ? key : 'full'
}

const formatFactTimeValue = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const timePart = raw.includes('T') ? raw.split('T')[1] || '' : raw
  const hhmm = timePart.slice(0, 5)
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : ''
}

const toDbTimeValue = (value) => {
  const hhmm = formatFactTimeValue(value)
  return hhmm ? `${hhmm}:00` : null
}

const parseTimeToMinutes = (value) => {
  const hhmm = formatFactTimeValue(value)
  if (!hhmm) return null
  const [hh, mm] = hhmm.split(':').map((v) => Number(v))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

const calcDurationHours = (startTime, endTime) => {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start == null || end == null) return null
  let diff = end - start
  if (diff < 0) diff += 24 * 60
  const hours = diff / 60
  return Number.isFinite(hours) ? Number(hours.toFixed(2)) : null
}

function WorkplacePage() {
  const { unit, workplaceId } = useParams()
  const supabase = useSupabase()
  const { user } = useAuth()
  const profile = useProfile()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const shiftWorkflowService = useMemo(() => createShiftWorkflowService(supabase), [supabase])

  const [workplace, setWorkplace] = useState(null)
  const [assignee, setAssignee] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [equipmentSubsystems, setEquipmentSubsystems] = useState([])
  const [equipmentSystems, setEquipmentSystems] = useState([])
  const [equipmentMenuId, setEquipmentMenuId] = useState(null)
  const [equipmentMenuStep, setEquipmentMenuStep] = useState('status')
  const [equipmentSavingId, setEquipmentSavingId] = useState(null)
  const [activeTab, setActiveTab] = useState('daily')
  const [dailyEntries, setDailyEntries] = useState([])
  const [dailyInput, setDailyInput] = useState('')
  const [statementShiftDate, setStatementShiftDate] = useState(() => getCurrentShiftSlot().date)
  const [statementShiftType, setStatementShiftType] = useState(() => getCurrentShiftSlot().type)
  const [shiftIconMotion, setShiftIconMotion] = useState('')
  const [shiftIconPhase, setShiftIconPhase] = useState('idle')
  const [iconDisplayShiftType, setIconDisplayShiftType] = useState(() => getCurrentShiftSlot().type)
  const [savingEntry, setSavingEntry] = useState(false)
  const [journalId, setJournalId] = useState(null)
  const [chiefSessionId, setChiefSessionId] = useState(null)
  const [chiefWorkplaces, setChiefWorkplaces] = useState([])
  const [chiefAssignments, setChiefAssignments] = useState([])
  const [chiefCandidates, setChiefCandidates] = useState([])
  const [chiefDraftByWorkplace, setChiefDraftByWorkplace] = useState({})
  const [chiefFactDraftByWorkplace, setChiefFactDraftByWorkplace] = useState({})
  const [chiefExpandedSelects, setChiefExpandedSelects] = useState({})
  const [loadingChiefTeam, setLoadingChiefTeam] = useState(false)
  const [savingChiefTeam, setSavingChiefTeam] = useState(false)
  const [chiefTeamMessage, setChiefTeamMessage] = useState('')
  const [chiefTeamError, setChiefTeamError] = useState('')
  const [chiefBriefingTopic, setChiefBriefingTopic] = useState('')
  const [chiefRoundTopic, setChiefRoundTopic] = useState('')
  const [chiefNextChiefName, setChiefNextChiefName] = useState('не назначен')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const shiftIconStartTimerRef = useRef(null)
  const shiftIconOutTimerRef = useRef(null)
  const shiftIconInTimerRef = useRef(null)
  const viewedShiftCode = useMemo(() => getShiftCodeByDate(statementShiftDate, statementShiftType), [statementShiftDate, statementShiftType])
  const viewedShiftPeriod = useMemo(() => shiftPeriodLabel(statementShiftType), [statementShiftType])
  const currentShift = getCurrentShiftSlot()
  const isViewedCurrentShift = statementShiftDate === currentShift.date && statementShiftType === currentShift.type
  const canMoveForwardShift = useMemo(
    () => compareShiftSlots(statementShiftDate, statementShiftType, currentShift.date, currentShift.type) < 0,
    [statementShiftDate, statementShiftType, currentShift.date, currentShift.type],
  )
  const canSelectNightOnDate = useMemo(() => {
    if (statementShiftDate !== currentShift.date) return true
    return currentShift.type === 'night'
  }, [statementShiftDate, currentShift.date, currentShift.type])
  const isChiefWorkplaceView = useMemo(() => isChiefWorkplace(workplace), [workplace])
  const isFormationMode = useMemo(
    () =>
      isChiefWorkplaceView &&
      statementShiftDate === currentShift.date &&
      statementShiftType === currentShift.type,
    [isChiefWorkplaceView, statementShiftDate, statementShiftType, currentShift.date, currentShift.type],
  )
  const nextShiftSlot = useMemo(
    () => moveShiftSlot(statementShiftDate, statementShiftType, 1),
    [statementShiftDate, statementShiftType],
  )
  const chiefNextAcceptanceCount = useMemo(
    () => (chiefWorkplaces || []).filter((wp) => {
      const division = workplaceDivisionKey(wp)
      return (division === 'boiler' || division === 'turbine') && !isChiefWorkplace(wp) && !isReserveWorkplace(wp)
    }).length,
    [chiefWorkplaces],
  )
  const defaultFactDraft = useCallback(
    (shiftType) => ({
      attendance_status: 'full',
      actual_start_time: shiftType === 'night' ? '21:00' : '09:00',
      actual_end_time: shiftType === 'night' ? '09:00' : '21:00',
      actual_hours: '12',
      fact_note: '',
    }),
    [],
  )

  const isEmployeeInShift = useCallback((rows, date, type) => {
    const dayRows = (rows || []).filter((r) => String(r.date) === String(date))
    const has12 = dayRows.some((r) => Math.round(Number(r?.planned_hours || 0)) === 12)
    const has3 = dayRows.some((r) => Math.round(Number(r?.planned_hours || 0)) === 3)
    return type === 'night' ? has3 : has12
  }, [])

  const buildChiefScheduleFallback = useCallback((workplacesList, scheduleRows, date, type) => {
    const byEmp = new Map()
    ;(scheduleRows || []).forEach((row) => {
      const key = String(row.employee_id || '')
      if (!key) return
      const list = byEmp.get(key) || []
      list.push(row)
      byEmp.set(key, list)
    })
    const candidates = []
    byEmp.forEach((rows) => {
      if (!isEmployeeInShift(rows, date, type)) return
      const sample = rows[0]
      candidates.push({
        id: sample.employee_id,
        positionId: sample.employees?.position_id ?? null,
        positionName: sample.employees?.positions?.name || '',
        label: [sample.employees?.last_name, sample.employees?.first_name, sample.employees?.middle_name].filter(Boolean).join(' ') || `ID ${sample.employee_id}`,
      })
    })
    candidates.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    const used = new Set()
    const draft = {}
    ;(workplacesList || [])
      .filter((wp) => workplaceDivisionKey(wp) === 'boiler' || workplaceDivisionKey(wp) === 'turbine')
      .filter((wp) => !isChiefWorkplace(wp) && !isReserveWorkplace(wp))
      .forEach((wp) => {
        const wpPosId = wp?.position_id ?? null
        const wpText = normalizeRoleText(wp?.position_name || wp?.position || wp?.name || '')
        const candidate =
          candidates.find((emp) => wpPosId && Number(emp.positionId) === Number(wpPosId) && !used.has(String(emp.id))) ||
          candidates.find((emp) => {
            if (used.has(String(emp.id))) return false
            const pos = normalizeRoleText(emp.positionName)
            return wpText && pos && (pos.includes(wpText) || wpText.includes(pos))
          }) ||
          candidates.find((emp) => !used.has(String(emp.id))) ||
          null
        if (!candidate) return
        used.add(String(candidate.id))
        draft[String(wp.id)] = String(candidate.id)
      })
    return { draft, candidates }
  }, [isEmployeeInShift])

  useEffect(() => {
    if (iconDisplayShiftType === statementShiftType) return
    if (shiftIconStartTimerRef.current) clearTimeout(shiftIconStartTimerRef.current)
    if (shiftIconOutTimerRef.current) clearTimeout(shiftIconOutTimerRef.current)
    if (shiftIconInTimerRef.current) clearTimeout(shiftIconInTimerRef.current)
    shiftIconStartTimerRef.current = setTimeout(() => {
      setShiftIconPhase('out')
      shiftIconOutTimerRef.current = setTimeout(() => {
        setIconDisplayShiftType(statementShiftType)
        setShiftIconPhase('in')
        shiftIconInTimerRef.current = setTimeout(() => {
          setShiftIconPhase('idle')
          setShiftIconMotion('')
        }, 170)
      }, 170)
    }, 0)
    return () => {
      if (shiftIconStartTimerRef.current) clearTimeout(shiftIconStartTimerRef.current)
      if (shiftIconOutTimerRef.current) clearTimeout(shiftIconOutTimerRef.current)
      if (shiftIconInTimerRef.current) clearTimeout(shiftIconInTimerRef.current)
    }
  }, [statementShiftType, iconDisplayShiftType, shiftIconMotion])

  const subsystemsById = useMemo(
    () => new Map((equipmentSubsystems || []).map((row) => [String(row.id), row])),
    [equipmentSubsystems],
  )
  const systemsById = useMemo(
    () => new Map((equipmentSystems || []).map((row) => [String(row.id), row])),
    [equipmentSystems],
  )

  const normalizeEquipmentStatus = (value) => {
    const text = normalizeKey(value)
    if (text.includes('резерв')) return 'Резерв'
    if (text.includes('ремонт')) return 'Ремонт'
    if (text.includes('работ')) return 'Работа'
    return 'Работа'
  }

  const toDbEquipmentStatus = (value) => {
    const text = normalizeKey(value)
    if (text.includes('резерв')) return 'резерв'
    if (text.includes('ремонт')) return 'ремонт'
    return 'работа'
  }

  const formatEquipmentStateLabel = (item) => {
    const base = String(item.stationNumber || item.dispatchLabel || '').trim() || '—'
    const status = normalizeEquipmentStatus(item.status)
    if (status === 'Резерв') return `(${base})`
    if (status === 'Ремонт') return `[${base}]`
    return base
  }

  const equipmentCellClass = (status) => {
    const normalized = normalizeEquipmentStatus(status)
    if (normalized === 'Резерв') return 'border-emerald-400/50 bg-emerald-500/15'
    if (normalized === 'Ремонт') return 'border-slate-300/40 bg-slate-400/15'
    return 'border-rose-400/50 bg-rose-500/15'
  }

  const isPumpEquipment = (item) => {
    const source = [
      item?.systemName,
      item?.subsystemName,
      item?.dispatchLabel,
      item?.stationNumber,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (
      source.includes('насос') ||
      /\bкнт\b|\bкнб\b|кнп|пэн|нтв|цн|нпс|нрс|нпт|ндб|нбнт|сл\.н|рмн|амн|пмн|нго|пожн|дцн|\bпн\b|pump|feed|condensate/.test(source)
    )
  }

  const reserveModeLabel = (value) => {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return ''
    if (text.includes('гор') || text === 'hot') return 'Г'
    if (text.includes('хол') || text === 'cold') return 'Х'
    if (text.includes('авр') || text === 'avr') return 'А'
    return text[0]?.toUpperCase() || ''
  }

  const toDbReserveMode = (value) => {
    const text = String(value || '').trim().toLowerCase()
    if (text.includes('гор')) return 'hot'
    if (text.includes('хол')) return 'cold'
    if (text.includes('авр')) return 'avr'
    return null
  }

  const reserveModeCandidates = (normalizedMode) => {
    if (normalizedMode === 'hot') return ['горячий', 'Горячий', 'hot', 'HOT']
    if (normalizedMode === 'cold') return ['холодный', 'Холодный', 'cold', 'COLD']
    if (normalizedMode === 'avr') return ['АВР', 'авр', 'Авр', 'avr', 'AVR']
    return []
  }

  const extractEquipmentIndex = (name) => {
    const source = String(name || '').toUpperCase()
    const matches = source.match(/\d+[А-ЯA-Z]?/g) || []
    if (!matches.length) return ''
    return matches[matches.length - 1]
  }

  const deriveDispatchLabel = (equipmentName, stationNumber) => {
    const station = normalizeStationValue(stationNumber)
    if (station) return station

    const source = String(equipmentName || '').replace(/\s+/g, ' ').trim()
    if (!source) return ''

    const patterns = [
      /ПНД\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /ПВД\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /КНТ\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /ПЭН\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /ОЭ\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /ТГ\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /ПТ\s*[-–]?\s*(\d+[-/]\d+[-/]\d+(?:\/\d+)?)/i,
      /ТА\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
      /КА\s*[-–]?\s*№?\s*(\d+[А-ЯA-Z]?)/i,
    ]

    for (const regex of patterns) {
      const match = source.match(regex)
      if (match) {
        const label = String(regex.source).split('\\s')[0].replace(/[^A-Za-zА-Яа-я]/g, '').toUpperCase()
        return `${label} ${String(match[1]).toUpperCase()}`
      }
    }

    return source.length > 24 ? `${source.slice(0, 24)}…` : source
  }

  const latestSnapshotEntry = useMemo(() => {
    const snapshots = (dailyEntries || []).filter((entry) => hasTag(entry.tags, 'entry_kind:equipment_snapshot'))
    if (!snapshots.length) return null
    return [...snapshots].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }, [dailyEntries])

  const statementEntries = useMemo(() => {
    return (dailyEntries || []).filter((entry) => !hasTag(entry.tags, 'entry_kind:equipment_snapshot'))
  }, [dailyEntries])

  const equipmentViewList = useMemo(() => {
    if (isViewedCurrentShift) return equipmentList
    if (!latestSnapshotEntry?.body) return equipmentList
    try {
      const parsed = JSON.parse(latestSnapshotEntry.body)
      if (!parsed || typeof parsed !== 'object') return equipmentList
      return (equipmentList || []).map((item) => {
        const snap = parsed[String(item.id)]
        if (!snap || typeof snap !== 'object') return item
        return {
          ...item,
          status: snap.status || item.status,
          reserve_mode: snap.reserve_mode ?? item.reserve_mode,
        }
      })
    } catch {
      return equipmentList
    }
  }, [equipmentList, latestSnapshotEntry, isViewedCurrentShift])

  const equipmentTree = useMemo(() => {
    const systemMap = new Map()
    for (const item of equipmentViewList) {
      const systemName = item?.systemName || item?.equipment_system || 'Без системы'
      const subsystemName = item?.subsystemName || 'Без подсистемы'
      if (!systemMap.has(systemName)) systemMap.set(systemName, new Map())
      const subsystemMap = systemMap.get(systemName)
      if (!subsystemMap.has(subsystemName)) subsystemMap.set(subsystemName, [])
      subsystemMap.get(subsystemName).push(item)
    }
    return [...systemMap.entries()]
      .map(([systemName, subsystemMap]) => ({
        systemName,
        subsystems: [...subsystemMap.entries()]
          .map(([subsystemName, units]) => ({
            subsystemName,
            units: [...units].sort((a, b) =>
              String(a.stationNumber || '').localeCompare(String(b.stationNumber || ''), 'ru', { numeric: true }),
            ),
          }))
          .sort((a, b) => String(a.subsystemName).localeCompare(String(b.subsystemName), 'ru')),
      }))
      .sort((a, b) => String(a.systemName).localeCompare(String(b.systemName), 'ru'))
  }, [equipmentViewList])

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
      const slot = getCurrentShiftSlot()
      setStatementShiftDate(slot.date)
      setStatementShiftType(slot.type)
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [scheduleService, unit, workplaceId])

  useEffect(() => {
    let active = true
    async function loadViewedAssignee() {
      if (!workplace) {
        setAssignee(null)
        return
      }
      const sessionRes = await handoverService.fetchSession({
        unit,
        shiftDate: statementShiftDate,
        shiftType: statementShiftType,
      })
      if (!active) return
      const sessionId = sessionRes?.data?.id
      if (!sessionId) {
        setAssignee(null)
        return
      }
      const assignmentsRes = await handoverService.fetchAssignments({ sessionId })
      if (!active) return
      if (isChiefWorkplace(workplace)) {
        const chiefEmployeeId = sessionRes?.data?.chief_employee_id
        const chiefFromAssignments = (assignmentsRes?.data || []).find(
          (row) =>
            row?.is_present !== false &&
            (Number(row?.employee_id) === Number(chiefEmployeeId) ||
              isChiefPosition(row?.position_name || row?.employees?.positions?.name)),
        )
        if (chiefFromAssignments?.employees) {
          const fio = [
            chiefFromAssignments.employees.last_name,
            chiefFromAssignments.employees.first_name,
            chiefFromAssignments.employees.middle_name,
          ]
            .filter(Boolean)
            .join(' ')
          setAssignee({
            id: chiefFromAssignments.employee_id,
            fio: fio || `ID ${chiefFromAssignments.employee_id}`,
            position: chiefFromAssignments.position_name || chiefFromAssignments.employees?.positions?.name || '',
          })
          return
        }
        if (chiefEmployeeId) {
          const chiefEmpRes = await supabase
            .from('employees')
            .select('id, first_name, last_name, middle_name, positions:position_id(name)')
            .eq('id', Number(chiefEmployeeId))
            .maybeSingle()
          if (!active) return
          if (!chiefEmpRes.error && chiefEmpRes.data) {
            const fio = [chiefEmpRes.data.last_name, chiefEmpRes.data.first_name, chiefEmpRes.data.middle_name]
              .filter(Boolean)
              .join(' ')
            setAssignee({
              id: chiefEmpRes.data.id,
              fio: fio || `ID ${chiefEmpRes.data.id}`,
              position: chiefEmpRes.data.positions?.name || '',
            })
            return
          }
        }
      }
      const wpIdKey = normalizeKey(workplaceId)
      const wpCodeKey = normalizeKey(workplace?.code)
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
        const toDate = statementShiftType === 'night' ? addDays(statementShiftDate, 1) : statementShiftDate
        const schedRes = await scheduleService.fetchRange({ from: statementShiftDate, to: toDate, unit })
        if (!active || schedRes?.error) {
          setAssignee(null)
          return
        }
        const byEmp = new Map()
        ;(schedRes.data || []).forEach((row) => {
          const key = String(row.employee_id || '')
          if (!key) return
          const list = byEmp.get(key) || []
          list.push(row)
          byEmp.set(key, list)
        })
        const candidates = []
        byEmp.forEach((rows) => {
          const dayRows = rows.filter((r) => String(r.date) === statementShiftDate)
          const has12 = dayRows.some((r) => Math.round(Number(r?.planned_hours || 0)) === 12)
          const has3 = dayRows.some((r) => Math.round(Number(r?.planned_hours || 0)) === 3)
          const has9 = rows.some((r) => Math.round(Number(r?.planned_hours || 0)) === 9)
          const inShift = statementShiftType === 'night' ? has3 : has12 && !has3 && !has9
          if (!inShift) return
          const sample = rows[0]
          candidates.push({
            id: sample.employee_id,
            positionId: sample.employees?.position_id ?? null,
            positionName: sample.employees?.positions?.name || '',
            fio: [sample.employees?.last_name, sample.employees?.first_name, sample.employees?.middle_name].filter(Boolean).join(' '),
          })
        })
        const wpPositionId = workplace?.position_id ?? null
        const wpPositionText = normalizeRoleText(workplace?.position_name || workplace?.position || workplace?.name || '')
        const picked =
          candidates.find((emp) => isChiefWorkplace(workplace) && isChiefPosition(emp.positionName)) ||
          candidates.find((emp) => wpPositionId && Number(emp.positionId) === Number(wpPositionId)) ||
          candidates.find((emp) => {
            const pos = normalizeRoleText(emp.positionName)
            return wpPositionText && pos && (pos.includes(wpPositionText) || wpPositionText.includes(pos))
          }) ||
          null
        setAssignee(
          picked
            ? {
                id: picked.id,
                fio: picked.fio || `ID ${picked.id}`,
                position: picked.positionName || '',
              }
            : null,
        )
      }
    }
    void loadViewedAssignee()
    return () => {
      active = false
    }
  }, [handoverService, scheduleService, supabase, unit, statementShiftDate, statementShiftType, workplace, workplaceId])

  useEffect(() => {
    let active = true
    async function loadChiefTeam() {
      if (!isChiefWorkplaceView) {
        setChiefSessionId(null)
        setChiefWorkplaces([])
        setChiefAssignments([])
        setChiefCandidates([])
        setChiefDraftByWorkplace({})
        setChiefFactDraftByWorkplace({})
        setChiefExpandedSelects({})
        return
      }
      setLoadingChiefTeam(true)
      setChiefTeamError('')
      setChiefTeamMessage('')
      const [workplacesRes, sessionRes] = await Promise.all([
        scheduleService.fetchWorkplaces({ unit }),
        handoverService.fetchSession({ unit, shiftDate: statementShiftDate, shiftType: statementShiftType }),
      ])
      if (!active) return
      if (workplacesRes?.error) {
        setChiefTeamError(workplacesRes.error.message || 'Не удалось загрузить рабочие места')
        setLoadingChiefTeam(false)
        return
      }
      const sid = sessionRes?.data?.id || null
      setChiefSessionId(sid)
      setChiefWorkplaces(workplacesRes.data || [])
      let assignments = []
      if (sid) {
        const assRes = await handoverService.fetchAssignments({ sessionId: sid })
        if (!active) return
        assignments = assRes?.error ? [] : assRes.data || []
      }
      setChiefAssignments(assignments)
      const byWpId = new Map((workplacesRes.data || []).map((wp) => [String(wp.id), wp]))
      const byWpCode = new Map((workplacesRes.data || []).filter((wp) => wp.code).map((wp) => [normalizeKey(wp.code), wp]))
      const byWpName = new Map((workplacesRes.data || []).filter((wp) => wp.name).map((wp) => [normalizeKey(wp.name), wp]))
      const nextDraft = {}
      const nextFactDraft = {}
      ;(assignments || []).forEach((row) => {
        if (row?.is_present === false || !row?.employee_id) return
        const wpRaw = String(row?.workplace_code || '')
        const wp = byWpId.get(wpRaw) || byWpCode.get(normalizeKey(wpRaw)) || byWpName.get(normalizeKey(wpRaw))
        const key = wp?.id ? String(wp.id) : ''
        if (!key) return
        if (!nextDraft[key]) nextDraft[key] = String(row.employee_id)
        nextFactDraft[key] = {
          attendance_status: normalizeFactStatus(row?.attendance_status),
          actual_start_time: formatFactTimeValue(row?.actual_start_time) || defaultFactDraft(statementShiftType).actual_start_time,
          actual_end_time: formatFactTimeValue(row?.actual_end_time) || defaultFactDraft(statementShiftType).actual_end_time,
          actual_hours:
            row?.actual_hours == null || row?.actual_hours === ''
              ? defaultFactDraft(statementShiftType).actual_hours
              : String(row.actual_hours),
          fact_note: String(row?.fact_note || row?.note || ''),
        }
      })
      const toDate = statementShiftType === 'night' ? addDays(statementShiftDate, 1) : statementShiftDate
      const schedRes = await scheduleService.fetchRange({ from: statementShiftDate, to: toDate, unit })
      if (!active) return
      const fallback = buildChiefScheduleFallback(workplacesRes.data || [], schedRes?.data || [], statementShiftDate, statementShiftType)
      const resolvedDraft = Object.keys(nextDraft).length ? nextDraft : fallback.draft
      Object.keys(resolvedDraft || {}).forEach((workplaceKey) => {
        if (nextFactDraft[workplaceKey]) return
        nextFactDraft[workplaceKey] = defaultFactDraft(statementShiftType)
      })
      setChiefDraftByWorkplace(resolvedDraft)
      setChiefFactDraftByWorkplace(nextFactDraft)

      setChiefCandidates(fallback.candidates)
      setLoadingChiefTeam(false)
    }
    void loadChiefTeam()
    return () => {
      active = false
    }
  }, [buildChiefScheduleFallback, defaultFactDraft, handoverService, isChiefWorkplaceView, scheduleService, statementShiftDate, statementShiftType, unit])

  useEffect(() => {
    let active = true
    async function loadChiefTopicsAndNextChief() {
      if (!isChiefWorkplaceView) {
        setChiefBriefingTopic('')
        setChiefRoundTopic('')
        setChiefNextChiefName('не назначен')
        return
      }
      const topicRes = await handoverService.fetchTopicForDate({ unit, shiftDate: statementShiftDate })
      if (!active) return
      setChiefBriefingTopic(topicRes?.error ? '' : String(topicRes?.data?.topic || ''))
      setChiefRoundTopic(topicRes?.error ? '' : String(topicRes?.data?.round_topic || ''))

      const nextSessionRes = await handoverService.fetchSession({
        unit,
        shiftDate: nextShiftSlot.date,
        shiftType: nextShiftSlot.type,
      })
      if (!active) return
      const nextChiefId = nextSessionRes?.data?.chief_employee_id
      if (!nextChiefId) {
        setChiefNextChiefName('не назначен')
        return
      }
      const empRes = await supabase
        .from('employees')
        .select('id, first_name, last_name, middle_name')
        .eq('id', Number(nextChiefId))
        .maybeSingle()
      if (!active) return
      if (empRes?.error || !empRes?.data) {
        setChiefNextChiefName('не назначен')
        return
      }
      const fio = [empRes.data.last_name, empRes.data.first_name, empRes.data.middle_name].filter(Boolean).join(' ')
      setChiefNextChiefName(fio || 'не назначен')
    }
    void loadChiefTopicsAndNextChief()
    return () => {
      active = false
    }
  }, [handoverService, isChiefWorkplaceView, nextShiftSlot.date, nextShiftSlot.type, statementShiftDate, supabase, unit])

  useEffect(() => {
    if (compareShiftSlots(statementShiftDate, statementShiftType, currentShift.date, currentShift.type) <= 0) return
    const correctionTimer = setTimeout(() => {
      setStatementShiftDate(currentShift.date)
      setStatementShiftType(currentShift.type)
    }, 0)
    return () => clearTimeout(correctionTimer)
  }, [statementShiftDate, statementShiftType, currentShift.date, currentShift.type])

  useEffect(() => {
    let active = true
    async function loadSubsystems() {
      const subsystemRes = await supabase
        .from('subsystem_types')
        .select('id, code, full_name')
        .order('code', { ascending: true })
        .limit(3000)
      if (!active) return
      if (!subsystemRes.error) {
        setEquipmentSubsystems(
          (subsystemRes.data || []).map((row) => ({
            id: row.id,
            name: row.code || `ID ${row.id}`,
            description: row.full_name || null,
          })),
        )
      }

      const systemsRes = await supabase.from('equipment_systems').select('id, name').order('name', { ascending: true }).limit(1000)
      if (!active) return
      if (!systemsRes.error) setEquipmentSystems(systemsRes.data || [])
    }
    void loadSubsystems()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    async function loadEquipment() {
      if (!workplace?.code && !workplace?.name) {
        if (active) setEquipmentList([])
        return
      }
      const modern = await supabase.from('equipment').select('*').order('id', { ascending: true }).limit(3000)
      if (modern.error) return
      const eqRows = modern.data || []
      if (!active) return

      const workplaceControlVariants = new Set(
        [workplace?.code, workplace?.name]
          .filter(Boolean)
          .map((value) => compactControlPoint(value)),
      )

      const scopedEquipment = (eqRows || []).filter((item) =>
        workplaceControlVariants.has(compactControlPoint(item?.control_point)),
      )

      const mappedEquipment = scopedEquipment.map((item) => {
        const byTypeId = item?.subsystem_type_id ? subsystemsById.get(String(item.subsystem_type_id)) : null
        const nameSource = item?.name || item?.station_number || ''
        const subsystem = byTypeId || null
        const fallbackStation = extractEquipmentIndex(nameSource)
        const stationNumber =
          normalizeStationValue(item?.station_number) || normalizeStationValue(item?.name) || fallbackStation
        const dispatchLabel = deriveDispatchLabel(nameSource, stationNumber)

        return {
          ...item,
          stationNumber,
          dispatchLabel,
          subsystemName: subsystem?.name || null,
          systemName: systemsById.get(String(item?.system_id || ''))?.name || item?.equipment_system || null,
        }
      })

      if (active) setEquipmentList(mappedEquipment)
    }
    void loadEquipment()
    return () => {
      active = false
    }
  }, [supabase, workplace?.code, workplace?.name, subsystemsById, systemsById])

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

  const shiftTags = useMemo(
    () => [
      `shift_date:${statementShiftDate}`,
      `shift_type:${statementShiftType}`,
      `watch:${viewedShiftCode}`,
      `period:${viewedShiftPeriod}`,
    ],
    [statementShiftDate, statementShiftType, viewedShiftCode, viewedShiftPeriod],
  )

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
      const shiftDateTag = `shift_date:${statementShiftDate}`
      const shiftTypeTag = `shift_type:${statementShiftType}`
      const filtered = (data || []).filter((item) => {
        const tags = Array.isArray(item?.tags) ? item.tags : []
        const sameShift = tags.includes(shiftDateTag) && tags.includes(shiftTypeTag)
        if (!sameShift) return false
        if (isChiefWorkplaceView) return true
        const sameWorkplace = tags.includes(workplaceTag) || (workplace?.code && tags.includes(workplaceCodeTag))
        return sameWorkplace
      })
      setDailyEntries(
        [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      )
    }
    void loadDailyEntries()
    return () => {
      active = false
    }
  }, [isChiefWorkplaceView, journalId, supabase, unit, workplaceId, workplace?.code, statementShiftDate, statementShiftType])

  const buildSnapshotPayload = (list) => {
    const payload = {}
    for (const row of list || []) {
      payload[String(row.id)] = {
        status: row.status || null,
        reserve_mode: row.reserve_mode ?? null,
      }
    }
    return JSON.stringify(payload)
  }

  const handleAddDailyEntry = async () => {
    if (!journalId) {
      setError(isChiefWorkplaceView ? 'Не найден журнал для оперативного журнала.' : 'Не найден журнал для суточной ведомости.')
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
      tags: [
        `workplace:${String(workplaceId)}`,
        `workplace_code:${String(workplace?.code || '')}`,
        ...shiftTags,
        'entry_kind:note',
      ],
      created_by_profile_id: user?.id || null,
      created_by_employee_id: profile?.employee?.id || null,
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
    const shiftDateTag = `shift_date:${statementShiftDate}`
    const shiftTypeTag = `shift_type:${statementShiftType}`
    const filtered = (data || []).filter((item) => {
      const tags = Array.isArray(item?.tags) ? item.tags : []
      const sameShift = tags.includes(shiftDateTag) && tags.includes(shiftTypeTag)
      if (!sameShift) return false
      if (isChiefWorkplaceView) return true
      const sameWorkplace = tags.includes(workplaceTag) || (workplace?.code && tags.includes(workplaceCodeTag))
      return sameWorkplace
    })
    setDailyEntries(
      [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    )
  }

  const handleSetEquipmentStatus = async (item, nextStatus, reserveMode = null) => {
    if (!item?.id) return
    if (!isViewedCurrentShift) {
      setError('Состояние оборудования можно менять только для текущей смены.')
      return
    }
    setEquipmentSavingId(item.id)
    setError('')
    const dbStatus = toDbEquipmentStatus(nextStatus)
    let saveError = null
    const statusRes = await supabase.from('equipment').update({ status: dbStatus }).eq('id', item.id)
    saveError = statusRes.error
    let resolvedReserveMode = null

    if (!saveError && dbStatus === 'резерв' && isPumpEquipment(item)) {
      const normalizedMode = toDbReserveMode(reserveMode)
      const candidates = reserveModeCandidates(normalizedMode)
      if (candidates.length) {
        let reserveSaved = false
        for (const candidate of candidates) {
          const res = await supabase.from('equipment').update({ reserve_mode: candidate }).eq('id', item.id)
          if (!res.error) {
            reserveSaved = true
            resolvedReserveMode = candidate
            break
          }
          saveError = res.error
          if (!String(res.error?.message || '').toLowerCase().includes('invalid input value for enum reserve_mode')) {
            break
          }
        }
        if (!reserveSaved && saveError && String(saveError.message || '').toLowerCase().includes('column') && String(saveError.message || '').includes('reserve_mode')) {
          saveError = null
        }
      }
    } else if (!saveError) {
      const clearRes = await supabase.from('equipment').update({ reserve_mode: null }).eq('id', item.id)
      if (clearRes.error && !(String(clearRes.error.message || '').toLowerCase().includes('column') && String(clearRes.error.message || '').includes('reserve_mode'))) {
        saveError = clearRes.error
      }
    }

    setEquipmentSavingId(null)
    setEquipmentMenuId(null)
    setEquipmentMenuStep('status')
    if (saveError) {
      setError(saveError.message || 'Не удалось изменить состояние оборудования')
      return
    }
    let nextEquipmentList = []
    setEquipmentList((prev) => {
      nextEquipmentList = prev.map((row) =>
        String(row.id) === String(item.id)
          ? { ...row, status: dbStatus, reserve_mode: resolvedReserveMode }
          : row,
      )
      return nextEquipmentList
    })

    const prevStateLabel = normalizeEquipmentStatus(item.status)
    const nextStateLabel = normalizeEquipmentStatus(dbStatus)
    const reserveSuffix = nextStateLabel === 'Резерв' && reserveModeLabel(resolvedReserveMode)
      ? ` · режим ${reserveModeLabel(resolvedReserveMode)}`
      : ''
    const eventBody = `${item.systemName || 'Система'} / ${item.subsystemName || 'Подсистема'} / ${item.stationNumber || item.dispatchLabel}: ${prevStateLabel} → ${nextStateLabel}${reserveSuffix}`
    const commonTags = [
      `workplace:${String(workplaceId)}`,
      `workplace_code:${String(workplace?.code || '')}`,
      ...shiftTags,
    ]
    if (journalId) {
      await supabase.from('entries').insert({
        journal_id: journalId,
        title: 'Изменение состояния оборудования',
        body: eventBody,
        type: 'daily',
        unit,
        tags: [...commonTags, 'entry_kind:equipment_state_change'],
        created_by_profile_id: user?.id || null,
        created_by_employee_id: profile?.employee?.id || null,
      })

      const snapshotBody = buildSnapshotPayload(nextEquipmentList.length ? nextEquipmentList : equipmentList)
      await supabase.from('entries').insert({
        journal_id: journalId,
        title: 'Снимок состояния оборудования',
        body: snapshotBody,
        type: 'daily',
        unit,
        tags: [...commonTags, 'entry_kind:equipment_snapshot'],
        created_by_profile_id: user?.id || null,
        created_by_employee_id: profile?.employee?.id || null,
      })

      setDailyEntries((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-event`,
          title: 'Изменение состояния оборудования',
          body: eventBody,
          created_at: new Date().toISOString(),
          tags: [...commonTags, 'entry_kind:equipment_state_change'],
        },
        {
          id: `local-${Date.now()}-snapshot`,
          title: 'Снимок состояния оборудования',
          body: snapshotBody,
          created_at: new Date().toISOString(),
          tags: [...commonTags, 'entry_kind:equipment_snapshot'],
        },
      ])
    }
  }

  const chiefRowsByDivision = useMemo(() => {
    const rows = (chiefWorkplaces || [])
      .filter((wp) => workplaceDivisionKey(wp) === 'boiler' || workplaceDivisionKey(wp) === 'turbine')
      .filter((wp) => !isChiefWorkplace(wp) && !isReserveWorkplace(wp))
      .map((wp) => ({
        id: String(wp.id),
        name: wp.name || wp.code || `Пост ${wp.id}`,
        code: wp.code || '',
        division: workplaceDivisionKey(wp),
        sort: Number.isFinite(Number(wp.sort_weight))
          ? Number(wp.sort_weight)
          : Number.isFinite(Number(wp.sort_order))
            ? Number(wp.sort_order)
            : Number.isFinite(Number(wp.order_index))
              ? Number(wp.order_index)
              : Number(wp.id || 999999),
      }))
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'ru'))
    return {
      boiler: rows.filter((row) => row.division === 'boiler'),
      turbine: rows.filter((row) => row.division === 'turbine'),
    }
  }, [chiefWorkplaces])
  const chiefAssignmentByWorkplace = useMemo(() => {
    const byId = new Map((chiefWorkplaces || []).map((wp) => [String(wp.id), wp]))
    const byCode = new Map(
      (chiefWorkplaces || [])
        .filter((wp) => wp.code)
        .map((wp) => [normalizeKey(wp.code), wp]),
    )
    const byName = new Map(
      (chiefWorkplaces || [])
        .filter((wp) => wp.name)
        .map((wp) => [normalizeKey(wp.name), wp]),
    )
    const map = new Map()
    ;(chiefAssignments || []).forEach((row) => {
      if (row?.is_present === false) return
      const raw = String(row?.workplace_code || '')
      const wp = byId.get(raw) || byCode.get(normalizeKey(raw)) || byName.get(normalizeKey(raw))
      const key = wp?.id ? String(wp.id) : raw
      if (!key || map.has(key)) return
      map.set(key, row)
    })
    return map
  }, [chiefAssignments, chiefWorkplaces])
  const chiefAssignedByWorkplace = useMemo(() => {
    const byId = new Map((chiefWorkplaces || []).map((wp) => [String(wp.id), wp]))
    const byCode = new Map(
      (chiefWorkplaces || [])
        .filter((wp) => wp.code)
        .map((wp) => [normalizeKey(wp.code), wp]),
    )
    const byName = new Map(
      (chiefWorkplaces || [])
        .filter((wp) => wp.name)
        .map((wp) => [normalizeKey(wp.name), wp]),
    )
    const map = new Map()
    ;(chiefAssignments || []).forEach((row) => {
      if (row?.is_present === false) return
      const raw = String(row?.workplace_code || '')
      const wp = byId.get(raw) || byCode.get(normalizeKey(raw)) || byName.get(normalizeKey(raw))
      const key = wp?.id ? String(wp.id) : raw
      if (!key || map.has(key)) return
      const fio = row?.employees
        ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
        : ''
      map.set(key, fio || `ID ${row?.employee_id || '—'}`)
    })
    return map
  }, [chiefAssignments, chiefWorkplaces])
  const chiefCandidateById = useMemo(() => {
    const map = new Map()
    ;(chiefCandidates || []).forEach((emp) => {
      map.set(String(emp.id), emp)
    })
    ;(chiefAssignments || []).forEach((row) => {
      const employeeId = String(row?.employee_id || '')
      if (!employeeId || map.has(employeeId)) return
      const label = row?.employees
        ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
        : ''
      map.set(employeeId, {
        id: row.employee_id,
        label: label || `ID ${row?.employee_id || '—'}`,
        positionName: row?.position_name || row?.employees?.positions?.name || '',
      })
    })
    return map
  }, [chiefAssignments, chiefCandidates])
  const chiefCandidateSetsByWorkplace = useMemo(() => {
    const map = {}
    ;(chiefRowsByDivision.boiler || []).concat(chiefRowsByDivision.turbine || []).forEach((row) => {
      const division = row.division
      const primary = (chiefCandidates || []).filter((c) => {
        const d = employeeDivisionKey(c.positionName)
        return d === division || d === 'other'
      })
      map[row.id] = { primary, extra: [] }
    })
    return map
  }, [chiefCandidates, chiefRowsByDivision.boiler, chiefRowsByDivision.turbine])
  const updateChiefFactDraft = useCallback((workplaceKey, patch) => {
    setChiefFactDraftByWorkplace((prev) => {
      const next = { ...prev }
      const current = next[workplaceKey] || defaultFactDraft(statementShiftType)
      next[workplaceKey] = {
        ...current,
        ...patch,
      }
      return next
    })
  }, [defaultFactDraft, statementShiftType])

  const handleSaveChiefTeam = async () => {
    if (!isChiefWorkplaceView) return
    if (!isFormationMode) {
      setChiefTeamMessage('')
      setChiefTeamError('Архивная смена доступна только для просмотра.')
      return
    }
    setSavingChiefTeam(true)
    setChiefTeamError('')
    setChiefTeamMessage('')
    let sessionId = chiefSessionId
    if (!sessionId) {
      const createRes = await shiftWorkflowService.createOrGetBriefing({
        date: statementShiftDate,
        unit,
        shiftType: statementShiftType,
      })
      const createdSessionId = Number(createRes?.data || 0)
      if (createRes?.error || !createdSessionId) {
        setSavingChiefTeam(false)
        setChiefTeamError(createRes?.error?.message || 'Не удалось создать или получить сессию смены')
        return
      }
      sessionId = createdSessionId
      setChiefSessionId(sessionId)
    }

    const chiefEmployeeId = assignee?.id || profile?.employee?.id || null
    if (chiefEmployeeId) {
      const updateRes = await handoverService.updateSession({
        sessionId,
        payload: {
          chief_employee_id: Number(chiefEmployeeId),
          status: 'active',
        },
      })
      if (updateRes?.error) {
        setSavingChiefTeam(false)
        setChiefTeamError(updateRes.error.message || 'Не удалось назначить начальника смены')
        return
      }
    }

    const used = new Set()
    const allowedCandidateIds = new Set((chiefCandidates || []).map((candidate) => String(candidate.id)))
    const payload = []
    Object.entries(chiefDraftByWorkplace).forEach(([workplaceKey, employeeValue]) => {
      const employeeId = String(employeeValue || '')
      if (!employeeId || used.has(employeeId) || !allowedCandidateIds.has(employeeId)) return
      used.add(employeeId)
      const source = chiefCandidates.find((c) => String(c.id) === employeeId)
      const fact = chiefFactDraftByWorkplace[workplaceKey] || defaultFactDraft(statementShiftType)
      const attendanceStatus = normalizeFactStatus(fact.attendance_status)
      const actualStart = attendanceStatus === 'absent' ? null : toDbTimeValue(fact.actual_start_time)
      const actualEnd = attendanceStatus === 'absent' ? null : toDbTimeValue(fact.actual_end_time)
      const computedHours = actualStart && actualEnd ? calcDurationHours(actualStart.slice(0, 5), actualEnd.slice(0, 5)) : null
      const parsedHours = Number(fact.actual_hours)
      const actualHours =
        attendanceStatus === 'absent'
          ? 0
          : Number.isFinite(parsedHours)
            ? Number(parsedHours.toFixed(2))
            : computedHours == null
              ? null
              : computedHours
      payload.push({
        session_id: sessionId,
        employee_id: Number(employeeId),
        workplace_code: workplaceKey,
        position_name: source?.positionName || null,
        source: 'manual',
        is_present: true,
        attendance_status: attendanceStatus,
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        actual_hours: actualHours,
        fact_note: String(fact.fact_note || '').trim() || null,
        note: String(fact.fact_note || '').trim() || null,
        confirmed_by_chief: false,
        confirmed_at: null,
      })
    })
    ;(chiefAssignments || []).forEach((row) => {
      const employeeId = String(row?.employee_id || '')
      if (!employeeId || used.has(employeeId)) return
      const assignmentKey = String(
        (chiefWorkplaces || []).find((wp) => {
          const wpId = String(wp?.id || '')
          const raw = String(row.workplace_code || '')
          return wpId && (raw === wpId || normalizeKey(raw) === normalizeKey(wp.code) || normalizeKey(raw) === normalizeKey(wp.name))
        })?.id || row.workplace_code || '',
      )
      const fact = chiefFactDraftByWorkplace[assignmentKey] || null
      const noteText = String(fact?.fact_note || row?.fact_note || row?.note || '').trim() || null
      payload.push({
        session_id: sessionId,
        employee_id: Number(employeeId),
        workplace_code: row.workplace_code,
        position_name: row.position_name || null,
        source: 'manual',
        is_present: false,
        attendance_status: 'absent',
        actual_start_time: null,
        actual_end_time: null,
        actual_hours: 0,
        fact_note: noteText,
        note: noteText,
        confirmed_by_chief: false,
        confirmed_at: null,
      })
    })

    if (!payload.length) {
      setSavingChiefTeam(false)
      setChiefTeamError('Нет сотрудников по графику для подтверждения состава этой смены.')
      return
    }

    const saveRes = await handoverService.upsertAssignments(payload)
    if (saveRes?.error) {
      setSavingChiefTeam(false)
      setChiefTeamError(saveRes.error.message || 'Не удалось сохранить состав смены')
      return
    }

    const confirmRes = await shiftWorkflowService.confirmBriefing({ briefingId: sessionId })
    if (confirmRes?.error) {
      setSavingChiefTeam(false)
      setChiefTeamError(confirmRes.error.message || 'Не удалось подтвердить состав смены')
      return
    }

    setSavingChiefTeam(false)
    setChiefTeamMessage('Состав смены подтвержден')
    const refreshed = await handoverService.fetchAssignments({ sessionId })
    if (!refreshed?.error) setChiefAssignments(refreshed.data || [])
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
            {activeTab === 'daily' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const next = moveShiftSlot(statementShiftDate, statementShiftType, -1)
                      setShiftIconMotion('left')
                      setStatementShiftDate(next.date)
                      setStatementShiftType(next.type)
                    }}
                    className="rounded-full border border-white/10 px-2 py-1 text-slate-300 hover:border-emerald-400/60"
                  >
                    ←
                  </button>
                  <input
                    type="date"
                    value={statementShiftDate}
                    max={currentShift.date}
                    onChange={(e) => {
                      const nextDate = e.target.value
                      setStatementShiftDate(nextDate)
                      if (compareShiftSlots(nextDate, statementShiftType, currentShift.date, currentShift.type) > 0) {
                        setStatementShiftType(currentShift.type)
                      }
                    }}
                    className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextType = statementShiftType === 'day' ? 'night' : 'day'
                      if (!canSelectNightOnDate && nextType === 'night') return
                      if (compareShiftSlots(statementShiftDate, nextType, currentShift.date, currentShift.type) > 0) return
                      setShiftIconMotion(nextType === 'night' ? 'right' : 'left')
                      setStatementShiftType(nextType)
                    }}
                    title={statementShiftType === 'day' ? 'Переключить на ночь' : 'Переключить на день'}
                    className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-slate-200"
                  >
                    <span
                      className={`inline-flex min-w-5 items-center justify-center text-sm leading-none ${
                        shiftIconPhase === 'out'
                          ? shiftIconMotion === 'left'
                            ? 'shift-icon-out-left'
                            : 'shift-icon-out-right'
                          : shiftIconPhase === 'in'
                            ? shiftIconMotion === 'left'
                              ? 'shift-icon-in-right'
                              : 'shift-icon-in-left'
                            : ''
                      }`}
                    >
                      {iconDisplayShiftType === 'day' ? '☀︎' : '☾'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canMoveForwardShift) return
                      const next = moveShiftSlot(statementShiftDate, statementShiftType, 1)
                      setShiftIconMotion('right')
                      setStatementShiftDate(next.date)
                      setStatementShiftType(next.type)
                    }}
                    disabled={!canMoveForwardShift}
                    className="rounded-full border border-white/10 px-2 py-1 text-slate-300 hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const slot = getCurrentShiftSlot()
                      setStatementShiftDate(slot.date)
                      setStatementShiftType(slot.type)
                    }}
                    className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-emerald-200"
                  >
                    Текущая смена
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Период {viewedShiftPeriod} · Вахта {viewedShiftCode}
                </p>
              </div>
            )}
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
                {isChiefWorkplaceView ? 'Оперативный журнал НС КТЦ' : 'Суточная ведомость'}
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
                {isChiefWorkplaceView && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">На смене</p>
                        <p className="mt-1 text-xs text-slate-200">
                          {isFormationMode
                            ? 'Текущая смена: доступно редактирование и подтверждение состава.'
                            : 'Архивная смена: только просмотр подтвержденного состава.'}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100">
                        {new Date(statementShiftDate).toLocaleDateString('ru-RU')} · {statementShiftType === 'night' ? 'Ночь' : 'День'}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      <p>Тема пятиминутки: <span className="text-slate-100">{chiefBriefingTopic || 'не задана'}</span></p>
                      <p>Тема обхода: <span className="text-slate-100">{chiefRoundTopic || 'не задана'}</span></p>
                    </div>
                    {loadingChiefTeam ? (
                      <p className="mt-3 text-xs text-slate-300">Загрузка состава смены…</p>
                    ) : (
                      <>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {[
                            { key: 'boiler', title: 'Котельное', rows: chiefRowsByDivision.boiler || [] },
                            { key: 'turbine', title: 'Турбинное', rows: chiefRowsByDivision.turbine || [] },
                          ].map((column) => (
                            <div key={column.key} className="rounded-lg border border-white/15 bg-slate-950/70 p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">{column.title}</p>
                              <div className="mt-2 space-y-2">
                                {column.rows.map((row) => {
                                  const rowKey = String(row.id)
                                  const selectedId = String(chiefDraftByWorkplace[rowKey] || '')
                                  const candidateSet = chiefCandidateSetsByWorkplace[rowKey] || { primary: [], extra: [] }
                                  const primary = candidateSet.primary || []
                                  const extra = candidateSet.extra || []
                                  const selectedCandidate = selectedId ? chiefCandidateById.get(selectedId) || null : null
                                  const selectedInPrimary = selectedCandidate
                                    ? primary.some((emp) => String(emp.id) === String(selectedCandidate.id))
                                    : false
                                  const selectedInExtra = selectedCandidate
                                    ? extra.some((emp) => String(emp.id) === String(selectedCandidate.id))
                                    : false
                                  const assignmentRow = chiefAssignmentByWorkplace.get(rowKey) || null
                                  const defaultFact = defaultFactDraft(statementShiftType)
                                  const factRaw = chiefFactDraftByWorkplace[rowKey] || {}
                                  const factStatus = normalizeFactStatus(
                                    factRaw.attendance_status || assignmentRow?.attendance_status || defaultFact.attendance_status,
                                  )
                                  const factStart = formatFactTimeValue(
                                    factRaw.actual_start_time || assignmentRow?.actual_start_time || defaultFact.actual_start_time,
                                  )
                                  const factEnd = formatFactTimeValue(
                                    factRaw.actual_end_time || assignmentRow?.actual_end_time || defaultFact.actual_end_time,
                                  )
                                  const factHours = String(
                                    factRaw.actual_hours ??
                                      assignmentRow?.actual_hours ??
                                      defaultFact.actual_hours ??
                                      '',
                                  )
                                  const factNote = String(
                                    factRaw.fact_note ??
                                      assignmentRow?.fact_note ??
                                      assignmentRow?.note ??
                                      '',
                                  )
                                  const selectedLabel = isFormationMode
                                    ? selectedCandidate?.label || chiefAssignedByWorkplace.get(rowKey) || '—'
                                    : chiefAssignedByWorkplace.get(rowKey) || '—'
                                  const isExpanded = Boolean(chiefExpandedSelects[rowKey])
                                  return (
                                    <div key={rowKey}>
                                      <Link
                                        to={`/workplaces/${unit}/${row.id}`}
                                        className="text-xs text-emerald-200 underline decoration-emerald-300/30 underline-offset-2"
                                      >
                                        {row.name}
                                      </Link>
                                      {isFormationMode ? (
                                        <div className="mt-1">
                                          <select
                                            value={selectedId}
                                            onChange={(e) => {
                                              const nextValue = String(e.target.value || '')
                                              if (nextValue === '__more__') {
                                                setChiefExpandedSelects((prev) => ({ ...prev, [rowKey]: true }))
                                                return
                                              }
                                              setChiefDraftByWorkplace((prev) => {
                                                const next = { ...prev }
                                                if (!nextValue) {
                                                  delete next[rowKey]
                                                  setChiefFactDraftByWorkplace((factsPrev) => {
                                                    const factsNext = { ...factsPrev }
                                                    delete factsNext[rowKey]
                                                    return factsNext
                                                  })
                                                  return next
                                                }
                                                Object.keys(next).forEach((key) => {
                                                  if (key !== rowKey && String(next[key]) === nextValue) delete next[key]
                                                })
                                                next[rowKey] = nextValue
                                                setChiefFactDraftByWorkplace((factsPrev) => {
                                                  if (factsPrev[rowKey]) return factsPrev
                                                  return {
                                                    ...factsPrev,
                                                    [rowKey]: defaultFactDraft(statementShiftType),
                                                  }
                                                })
                                                return next
                                              })
                                            }}
                                            className="w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                          >
                                            <option value="">—</option>
                                            {selectedCandidate && !selectedInPrimary && !selectedInExtra && (
                                              <option value={selectedCandidate.id}>{selectedCandidate.label}</option>
                                            )}
                                            {primary.map((emp) => (
                                              <option key={emp.id} value={emp.id}>
                                                {emp.label}
                                              </option>
                                            ))}
                                            {!isExpanded && extra.length > 0 && <option value="__more__">Еще…</option>}
                                            {isExpanded &&
                                              extra.map((emp) => (
                                                <option key={`extra-${emp.id}`} value={emp.id}>
                                                  {emp.label}
                                                </option>
                                              ))}
                                          </select>
                                          {selectedId ? (
                                            <div className="mt-2 space-y-1 rounded-md border border-white/10 bg-black/20 p-2">
                                              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Факт смены</p>
                                              <select
                                                value={factStatus}
                                                onChange={(e) => {
                                                  const nextStatus = normalizeFactStatus(e.target.value)
                                                  if (nextStatus === 'absent') {
                                                    updateChiefFactDraft(rowKey, {
                                                      attendance_status: nextStatus,
                                                      actual_start_time: '',
                                                      actual_end_time: '',
                                                      actual_hours: '0',
                                                    })
                                                    return
                                                  }
                                                  if (nextStatus === 'full') {
                                                    updateChiefFactDraft(rowKey, {
                                                      attendance_status: nextStatus,
                                                      actual_start_time: defaultFact.actual_start_time,
                                                      actual_end_time: defaultFact.actual_end_time,
                                                      actual_hours: defaultFact.actual_hours,
                                                    })
                                                    return
                                                  }
                                                  const nextStart = factStart || defaultFact.actual_start_time
                                                  const nextEnd = factEnd || defaultFact.actual_end_time
                                                  const nextHours = calcDurationHours(nextStart, nextEnd)
                                                  updateChiefFactDraft(rowKey, {
                                                    attendance_status: nextStatus,
                                                    actual_start_time: nextStart,
                                                    actual_end_time: nextEnd,
                                                    actual_hours: nextHours == null ? factHours : String(nextHours),
                                                  })
                                                }}
                                                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                              >
                                                {FACT_STATUS_OPTIONS.map((item) => (
                                                  <option key={item.value} value={item.value}>
                                                    {item.label}
                                                  </option>
                                                ))}
                                              </select>
                                              <div className="grid grid-cols-2 gap-1">
                                                <input
                                                  type="time"
                                                  value={factStart}
                                                  disabled={factStatus === 'absent'}
                                                  onChange={(e) => {
                                                    const nextStart = e.target.value
                                                    const nextHours = calcDurationHours(nextStart, factEnd)
                                                    updateChiefFactDraft(rowKey, {
                                                      actual_start_time: nextStart,
                                                      actual_hours: nextHours == null ? factHours : String(nextHours),
                                                    })
                                                  }}
                                                  className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                                                />
                                                <input
                                                  type="time"
                                                  value={factEnd}
                                                  disabled={factStatus === 'absent'}
                                                  onChange={(e) => {
                                                    const nextEnd = e.target.value
                                                    const nextHours = calcDurationHours(factStart, nextEnd)
                                                    updateChiefFactDraft(rowKey, {
                                                      actual_end_time: nextEnd,
                                                      actual_hours: nextHours == null ? factHours : String(nextHours),
                                                    })
                                                  }}
                                                  className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                                                />
                                              </div>
                                              <div className="grid grid-cols-[1fr_auto] items-center gap-1">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.25"
                                                  value={factHours}
                                                  onChange={(e) => updateChiefFactDraft(rowKey, { actual_hours: e.target.value })}
                                                  className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                                                />
                                                <span className="text-[11px] text-slate-300">час</span>
                                              </div>
                                              <input
                                                type="text"
                                                value={factNote}
                                                onChange={(e) => updateChiefFactDraft(rowKey, { fact_note: e.target.value })}
                                                placeholder="Причина/комментарий"
                                                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                                              />
                                            </div>
                                          ) : (
                                            <p className="mt-1 text-[11px] text-slate-400">Назначьте сотрудника, затем заполните факт.</p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="mt-1 space-y-1">
                                          <p className="text-xs text-slate-100">{selectedLabel}</p>
                                          <p className="text-[11px] text-slate-300">
                                            Факт: {FACT_STATUS_LABELS[factStatus] || FACT_STATUS_LABELS.full}
                                            {factHours ? ` · ${factHours} ч` : ''}
                                            {factStart && factEnd ? ` · ${factStart}–${factEnd}` : ''}
                                          </p>
                                          {factNote && <p className="text-[11px] text-slate-400">Примечание: {factNote}</p>}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                {!column.rows.length && <p className="text-xs text-slate-400">Нет рабочих мест.</p>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {isFormationMode ? (
                          <div className="mt-3 space-y-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveChiefTeam()}
                              disabled={savingChiefTeam}
                              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {savingChiefTeam ? 'Подтверждаем…' : 'Подтвердить состав смены'}
                            </button>
                            <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2 text-xs text-slate-300">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Смену принимает</p>
                              <p className="mt-1 text-slate-100">
                                {new Date(nextShiftSlot.date).toLocaleDateString('ru-RU')} · Вахта {getShiftCodeByDate(nextShiftSlot.date, nextShiftSlot.type)} · {nextShiftSlot.type === 'night' ? 'Ночь' : 'День'} · НС КТЦ: {chiefNextChiefName}
                              </p>
                              <p className="mt-1 text-slate-400">
                                Рабочих мест к приемке: {chiefNextAcceptanceCount}.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-slate-300">
                            Архивная смена отображается в режиме чтения. Источник: подтвержденная сессия; при отсутствии данных используется график смены.
                          </p>
                        )}

                        {chiefTeamMessage && <p className="mt-2 text-xs text-emerald-300">{chiefTeamMessage}</p>}
                        {chiefTeamError && <p className="mt-2 text-xs text-rose-300">{chiefTeamError}</p>}
                      </>
                    )}
                  </div>
                )}
                <div
                  className={`grid gap-3 ${
                    isChiefWorkplaceView ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]'
                  }`}
                >
                  {!isChiefWorkplaceView && (
                    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Состав оборудования</p>
                      <div className="mt-1.5 space-y-1.5">
                        {equipmentTree.map((system) => (
                          <div key={system.systemName} className="rounded-md border border-white/10 bg-white/5 p-1.5">
                            <p className="text-[11px] font-semibold text-slate-300">{system.systemName}</p>
                            <div className="mt-1.5 space-y-1.5">
                              {system.subsystems.map((sub) => (
                                <div key={`${system.systemName}-${sub.subsystemName}`}>
                                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">{sub.subsystemName}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {sub.units.map((item) => (
                                      <div key={item.id} className="relative">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEquipmentMenuId((prev) => (prev === item.id ? null : item.id))
                                            setEquipmentMenuStep('status')
                                          }}
                                          className={`relative rounded border px-2 py-1 text-[11px] font-semibold text-slate-100 ${equipmentCellClass(item.status)}`}
                                          title="Изменить состояние"
                                        >
                                          {formatEquipmentStateLabel(item)}
                                          {normalizeEquipmentStatus(item.status) === 'Резерв' && reserveModeLabel(item.reserve_mode) && (
                                            <span className="absolute -right-1 -top-1 rounded-full border border-white/30 bg-slate-900 px-1 text-[9px] leading-none text-emerald-200">
                                              {reserveModeLabel(item.reserve_mode)}
                                            </span>
                                          )}
                                        </button>
                                        {equipmentMenuId === item.id && (
                                          <div className="absolute left-0 top-8 z-20 w-28 rounded-md border border-white/15 bg-slate-900 p-1 shadow-xl">
                                            {equipmentMenuStep === 'status' ? (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSetEquipmentStatus(item, 'Работа')}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  🔴 Работа
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (isPumpEquipment(item)) setEquipmentMenuStep('reserve')
                                                    else void handleSetEquipmentStatus(item, 'Резерв')
                                                  }}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  🟢 Резерв
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSetEquipmentStatus(item, 'Ремонт')}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  ⚪️ Ремонт
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSetEquipmentStatus(item, 'Резерв', 'горячий')}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  Г · Горячий
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSetEquipmentStatus(item, 'Резерв', 'холодный')}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  Х · Холодный
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSetEquipmentStatus(item, 'Резерв', 'АВР')}
                                                  className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-white/10"
                                                >
                                                  А · АВР
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEquipmentMenuStep('status')}
                                                  className="mt-1 block w-full rounded px-2 py-1 text-left text-[11px] text-slate-400 hover:bg-white/10"
                                                >
                                                  ← Назад
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                        {equipmentSavingId === item.id && <span className="ml-1 text-[10px] text-slate-400">...</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {!equipmentTree.length && (
                          <p className="text-xs text-slate-500">Закрепленное оборудование пока не найдено.</p>
                        )}
                      </div>
                    </div>
                  )}
                    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                      <div className="mt-2 space-y-1.5">
                        {statementEntries.map((item) => (
                          <p key={item.id} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                              : '--:--'}{' '}
                            : {item.body || '—'}
                          </p>
                        ))}
                        {!statementEntries.length && <p className="text-xs text-slate-500">Записей за эту смену пока нет.</p>}
                        <div className="rounded-md border border-emerald-500/25 bg-slate-900/70 px-2 py-1">
                          <div className="flex gap-2">
                            <span className="pt-1 text-xs text-emerald-200">
                              {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} :
                            </span>
                            <input
                              value={dailyInput}
                              onChange={(e) => setDailyInput(e.target.value)}
                              placeholder="Действие..."
                              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
                            />
                          </div>
                          <div className="mt-1 flex justify-end">
                            <button
                              onClick={() => void handleAddDailyEntry()}
                              disabled={savingEntry || !dailyInput.trim()}
                              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {savingEntry ? '...' : 'Добавить'}
                            </button>
                          </div>
                        </div>
                      </div>
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
