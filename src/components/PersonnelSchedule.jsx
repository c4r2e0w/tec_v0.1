import { Fragment, memo, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import Badge from './Badge'
import { calculateEmployeeMonthStats } from '../lib/productionNorm'

const IconSun = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <path d="M12 2v2.4M12 19.6V22M4.4 4.4 6.2 6.2M17.8 17.8l1.8 1.8M2 12h2.4M19.6 12H22M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8" />
  </svg>
)

const IconMoon = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path
      d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11Z"
      fill="currentColor"
      stroke="currentColor"
    />
  </svg>
)

const IconLamp = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3c-3.5 0-6.5 2.8-6.5 6.3 0 2.5 1.5 4.7 3.7 5.8l.3.2V18a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-2.7l.3-.2c2.3-1.1 3.7-3.3 3.7-5.8C18.5 5.8 15.5 3 12 3Z" fill="currentColor" />
    <path d="M10 21h4" />
  </svg>
)

const IconCap = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 10.5 12 6l9 4.5-9 4.5-9-4.5Z" fill="currentColor" />
    <path d="M7 12v3.5c0 .8.6 1.5 1.3 1.8l3.2 1.2 3.2-1.2c.8-.3 1.3-1 1.3-1.8V12" />
  </svg>
)

const IconDrop = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3c-2.5 4-5.5 7.4-5.5 10.2A5.5 5.5 0 0 0 12 18.5a5.5 5.5 0 0 0 5.5-5.3C17.5 10.5 14.5 7 12 3Z" fill="currentColor" />
  </svg>
)

const IconTicket = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7.5h16l-2 9H6l-2-9Z" fill="currentColor" />
    <path d="M8 10.5h8" stroke="rgba(255,255,255,0.85)" />
    <path d="M9 13.5h6" stroke="rgba(255,255,255,0.85)" />
  </svg>
)

const IconPalm = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 21V11" strokeWidth="1.4" />
    <path d="M8 7c1.5-.8 3.1-1 4.5-.6C14.9 7 17 9 17 9s-2.6.4-4.2-.3C10.8 8 8 9 8 9s.2-1.3 0-2Z" fill="currentColor" />
    <path d="M7 9c-1-.9-2.3-1.3-3.6-1 .3 1.5 1 3 2.7 3.4.9.2 2-.1 2-.1" />
    <path d="M16.5 10.5c1-.6 2.2-.6 3.2-.3-.2 1.4-.8 2.6-2.3 2.9-.7.1-1.6 0-1.6 0" />
  </svg>
)

const IconTie = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 3h4l-1 3h-2l-1-3Z" fill="currentColor" />
    <path d="M11 6h2l-1 3-1-3Z" />
    <path d="M10.5 9 9 18l3 3 3-3-1.5-9h-3Z" fill="currentColor" />
  </svg>
)

const IconBed = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 15h14" strokeWidth="1.4" />
    <path d="M4 17h16" />
    <path d="M7 9.2h4l-4 3.6h4" />
    <path d="M12 7h3l-3 2.7h3" />
  </svg>
)

const IconBulb = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 19.5h4" />
    <path d="M12 3.5a5.5 5.5 0 0 0-2.5 10.4V16a1.6 1.6 0 0 0 1.6 1.6h1.8A1.6 1.6 0 0 0 14.5 16v-2.1A5.5 5.5 0 0 0 12 3.5Z" fill="currentColor" />
  </svg>
)

const IconAlert = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3 3 20h18L12 3Z" fill="currentColor" />
    <path d="M12 8.5v6" stroke="rgba(255,255,255,0.9)" />
    <circle cx="12" cy="17.8" r="0.9" fill="rgba(255,255,255,0.9)" />
  </svg>
)

const IconCross = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" fill="currentColor" />
    <path d="M10 4h4v8h8v4h-8v8h-4v-8H2v-4h8Z" fill="rgba(255,255,255,0.85)" />
  </svg>
)

const IconOff = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 7h12l-6 6-6-6Z" fill="currentColor" />
    <path d="M6 13h12l-6 6-6-6Z" fill="currentColor" />
  </svg>
)

const isValidShiftDigit = (h) => {
  const v = Math.round(h)
  return v === 3 || v === 9 || v === 4 || v === 8 || v === 12
}

const ScheduleCell = memo(function ScheduleCell({
  employeeId,
  date,
  cellEntries,
  selected,
  todayColumn,
  selectedDateColumn,
  formatCellValue,
  resolveIconType,
  iconCatalog,
  onClick,
}) {
  const displayValue = useMemo(() => formatCellValue(cellEntries), [cellEntries, formatCellValue])
  const pentagramType = useMemo(() => resolveIconType(cellEntries), [cellEntries, resolveIconType])
  const pentagramMeta = pentagramType ? iconCatalog[pentagramType] : null
  const hasDayOff = useMemo(() => {
    return cellEntries.some((item) => {
      const note = (item?.note || '').toLowerCase()
      const source = (item?.source || '').toLowerCase()
      return note.includes('отгул') || source.includes('comp_day_off')
    })
  }, [cellEntries])
  const hasWeekend = useMemo(() => {
    return cellEntries.some((item) => {
      const note = (item?.note || '').toLowerCase()
      const source = (item?.source || '').toLowerCase()
      return note.includes('выход') || source === 'off'
    })
  }, [cellEntries])
  const hasVacation = useMemo(() => {
    return cellEntries.some((item) => {
      const note = (item?.note || '').toLowerCase()
      const source = (item?.source || '').toLowerCase()
      return note.includes('отпуск') || source.includes('vacation')
    })
  }, [cellEntries])
  const hasDonor = useMemo(() => {
    return cellEntries.some((item) => {
      const note = (item?.note || '').toLowerCase()
      const source = (item?.source || '').toLowerCase()
      return note.includes('донор') || source.includes('donor')
    })
  }, [cellEntries])
  const hasTrip = useMemo(() => {
    return cellEntries.some((item) => {
      const note = (item?.note || '').toLowerCase()
      const source = (item?.source || '').toLowerCase()
      return note.includes('команд') || source.includes('business_trip')
    })
  }, [cellEntries])
  const parsedHours = useMemo(() => {
    const hours = []
    cellEntries.forEach((item) => {
      const raw = item?.planned_hours
      if (raw !== null && raw !== undefined && raw !== '') {
        if (typeof raw === 'string' && raw.includes('/')) {
          raw
            .split('/')
            .map((h) => Number(h))
            .filter((n) => Number.isFinite(n))
            .forEach((n) => hours.push(n))
        } else {
          const num = Number(raw)
          if (Number.isFinite(num)) hours.push(num)
        }
      }
    })
    if (hours.length) return hours
    const fromDisplay = (displayValue || '')
      .split(/[^0-9]+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
    return fromDisplay
  }, [cellEntries, displayValue])
  const orderedHours = useMemo(() => {
    const validHours = parsedHours.filter((h) => Number.isFinite(h) && h > 0)
    if (!validHours.length) return []
    if ((displayValue || '').includes('9/3')) return [9, 3]
    const has3 = validHours.some((h) => Math.round(h) === 3)
    const has9 = validHours.some((h) => Math.round(h) === 9)
    if (has3 && has9) return [9, 3]
    if (validHours.length > 1) return [...validHours].sort((a, b) => b - a)
    return validHours
  }, [parsedHours, displayValue])
  const iconSet = useMemo(() => {
    const icons = []
    if (hasDayOff) {
      icons.push({ type: 'off', color: '#cbd5e1', valid: true })
    }
    if (hasWeekend) {
      icons.push({ type: 'tie', color: '#cbd5e1', valid: true })
    }
    if (hasVacation) {
      icons.push({ type: 'palm', color: '#cbd5e1', valid: true })
    }
    if (!orderedHours.length) {
      if (!hasDayOff) {
        if (hasDonor) icons.push({ type: 'drop', color: '#cbd5e1', valid: true })
        if (hasTrip) icons.push({ type: 'ticket', color: '#cbd5e1', valid: true })
        if (pentagramMeta?.icon && !hasDonor && !hasTrip && !hasWeekend && !hasVacation) {
          icons.push({ type: pentagramMeta.icon, color: '#cbd5e1', valid: true })
        }
      }
      return icons
    }
    const pool = Array.isArray(cellEntries) ? [...cellEntries] : []
    const takeEntryForHour = (value) => {
      const idx = pool.findIndex((item) => Math.round(Number(item?.planned_hours)) === Math.round(value))
      if (idx !== -1) return pool.splice(idx, 1)[0]
      return null
    }
    const hoursIcons = orderedHours
      .map((raw) => {
        const h = Math.round(raw)
        if (!Number.isFinite(h) || h <= 0) return null
        const entry = takeEntryForHour(raw)
        const note = (entry?.note || '').toLowerCase()
        const source = (entry?.source || '').toLowerCase()
        const isDonor = note.includes('донор') || source.includes('donor')
        const isTrip = note.includes('команд') || source.includes('business_trip')
        const isWeekend = note.includes('выход') || source === 'off'
        const isVacation = note.includes('отпуск') || source.includes('vacation')
        const isTraining = note.includes('учеб') || note.includes('учёб') || note.includes('трен')
        const isNight = source.includes('night') || note.includes('ноч') || note.includes('отсып')
        const isShort = h <= 4
        const valid = isValidShiftDigit(h)
        let type = 'sun'
        if (isDonor) type = 'drop'
        else if (isTrip) type = 'ticket'
        else if (isVacation) type = 'palm'
        else if (isWeekend) type = 'tie'
        else if (isTraining) type = 'cap'
        else if (isNight || h === 3 || h === 9) type = 'moon'
        else if (isShort) type = 'lamp'
        const color = '#cbd5e1'
        return { type, color, valid }
      })
      .filter(Boolean)
    return icons.concat(hoursIcons)
  }, [orderedHours, cellEntries, hasDayOff, hasWeekend, hasVacation, hasDonor, hasTrip, pentagramMeta])

  const tooltip = useMemo(() => {
    const parts = []
    if (displayValue && displayValue !== '—') parts.push(`Часы: ${displayValue}`)
    if (hasDayOff) parts.push('Отгул')
    if (hasWeekend) parts.push('Выходной')
    if (hasVacation) parts.push('Отпуск')
    if (hasDonor) parts.push('Донорский день')
    if (hasTrip) parts.push('Командировка')
    if (!hasDayOff && !hasDonor && !hasTrip && pentagramMeta?.title) parts.push(pentagramMeta.title)
    const notes = cellEntries
      .map((i) => (i?.note || '').trim())
      .filter(Boolean)
      .slice(0, 2)
    if (notes.length) parts.push(notes.join(' / '))
    return parts.join(' · ')
  }, [displayValue, hasDayOff, hasWeekend, hasVacation, hasDonor, hasTrip, pentagramMeta, cellEntries])

  return (
    <td
      onClick={(e) => onClick(employeeId, date, e)}
      className={`group relative cursor-pointer px-0.5 py-0.5 align-top transition sm:px-1 sm:py-1 ${
        selected ? 'bg-accent/5' : selectedDateColumn ? 'bg-sky-400/10' : todayColumn ? 'bg-amber-300/10' : ''
      }`}
    >
      <div
        className={`relative flex min-h-[38px] items-end justify-center rounded-xl border px-2 pt-3 pb-1 text-[10px] font-semibold text-slate-100 transition-all duration-200 sm:min-h-[44px] sm:px-3 sm:pt-4 sm:text-[11px] ${
          selected
            ? 'scale-[1.02] border-accent/70 bg-accent/12 ring-2 ring-accent/45 ring-offset-2 ring-offset-slate-900 shadow-[0_0_0_1px_rgba(62,219,138,0.2),0_10px_26px_rgba(0,0,0,0.35)]'
            : selectedDateColumn && todayColumn
              ? 'border-cyan-300/50 bg-gradient-to-b from-amber-300/10 to-sky-400/12 shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_8px_20px_rgba(0,0,0,0.25)]'
              : selectedDateColumn
                ? 'border-sky-300/45 bg-sky-400/12 shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_8px_20px_rgba(0,0,0,0.22)]'
                : todayColumn
                  ? 'border-amber-300/45 bg-amber-300/10 shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_8px_20px_rgba(0,0,0,0.22)]'
            : 'border-white/10 bg-white/5 group-hover:-translate-y-[1px] group-hover:border-accent/45 group-hover:bg-accent/8 group-hover:shadow-[0_0_0_1px_rgba(62,219,138,0.15),0_8px_20px_rgba(0,0,0,0.32)]'
        }`}
        title={tooltip}
      >
        <div className="absolute left-1 top-1 flex items-center gap-1 text-[11px] opacity-90 sm:left-1.5 sm:top-1.5 sm:text-[12px]" aria-hidden>
          {iconSet.map((ic, idx) => {
            const key = `${ic.type}-${idx}`
            const style = { color: ic.color }
            if (ic.type === 'sun') return <IconSun key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'moon') return <IconMoon key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'lamp') return <IconLamp key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'cap') return <IconCap key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'bed') return <IconBed key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'bulb') return <IconBulb key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'alert') return <IconAlert key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'cross') return <IconCross key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'drop') return <IconDrop key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'ticket') return <IconTicket key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'palm') return <IconPalm key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'tie') return <IconTie key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            if (ic.type === 'off') return <IconOff key={key} className="drop-shadow-[0_0_6px_rgba(0,0,0,0.25)]" style={style} />
            return null
          })}
        </div>
        {displayValue || <span className="text-slate-500">—</span>}
      </div>
    </td>
  )
})

function PersonnelSchedule(props) {
  const {
    monthDates,
    unitCode,
    monthLabel,
    employeesFromSchedule,
    filterCategory,
    filterSection,
    filterQuery,
    filterQueryInput,
    positionFilter,
    positionOptions,
    positionsOpen,
    setFilterCategory,
    setFilterSection,
    setFilterQuery,
    setFilterQueryInput,
    setPositionFilter,
    setPositionsOpen,
    resetFilters,
    pinnedEmployees,
    hiddenEmployees,
    setPinnedEmployees,
    collapsedPositions,
    setCollapsedPositions,
    scheduleError,
    loadingSchedule,
    loadingStaff,
    staffError,
    monthStart,
    setMonthStart,
    groupedByPosition,
    selectedEmployeeIds,
    setSelectedEmployeeIds,
    scheduleByDay,
    formatCellValue,
    resolveIconType,
    iconCatalog,
    monthNorm,
    selectedCell,
    selectedCells,
    setSelectedCells,
    handleCellClick,
    handleApplyShift,
    applyShiftToSelected,
    setSelectionAnchor,
    setMenuCell,
    menuCell,
    shiftMenuPosition,
    shiftOptions,
    onBackToCard,
  } = props

  const personnelHref = useMemo(() => (unitCode ? `/${unitCode}/personnel` : '#'), [unitCode])
  const statusBadge = useMemo(() => {
    const isLoading = loadingStaff || loadingSchedule
    if (staffError || scheduleError) {
      return { text: 'Ошибка загрузки', tone: 'error' }
    }
    if (isLoading) {
      return { text: 'Обновляем данные…', tone: 'info' }
    }
    return { text: 'Данные актуальны', tone: 'ok' }
  }, [loadingStaff, loadingSchedule, staffError, scheduleError])
  const hoursSummary = useMemo(() => {
    const rows = employeesFromSchedule.map((emp) => {
      if (!monthNorm?.isWorkingDay) {
        return {
          id: emp.id,
          label: emp.label,
          totalHours: 0,
          adjustedNormHours: 0,
          overtimeHours: 0,
          nightHours: 0,
          holidayHours: 0,
          shiftCount: 0,
          handoverHours: 0,
          payableHours: 0,
          normReductionHours: 0,
        }
      }
      const stats = calculateEmployeeMonthStats({
        employeeId: emp.id,
        monthDates,
        scheduleByDay,
        calendarMeta: monthNorm,
      })
      return { id: emp.id, label: emp.label, ...stats }
    })
    const totalHours = rows.reduce((acc, r) => acc + r.totalHours, 0)
    const nightHours = rows.reduce((acc, r) => acc + r.nightHours, 0)
    const holidayHours = rows.reduce((acc, r) => acc + r.holidayHours, 0)
    const handoverHours = rows.reduce((acc, r) => acc + r.handoverHours, 0)
    const payableHours = rows.reduce((acc, r) => acc + r.payableHours, 0)
    const overtimeTotal = rows.reduce((acc, r) => acc + r.overtimeHours, 0)
    return {
      rows,
      norm: monthNorm?.normHours || 0,
      totalHours,
      nightHours,
      holidayHours,
      handoverHours,
      payableHours,
      overtimeTotal,
    }
  }, [employeesFromSchedule, monthDates, monthNorm, scheduleByDay])
  const [actionMenuRect, setActionMenuRect] = useState(null)
  const selectedCellKey = selectedCell ? `${selectedCell.employeeId}|${selectedCell.date}` : null
  const selectedCellsSet = useMemo(
    () => new Set(selectedCells.map((c) => `${c.employeeId}|${c.date}`)),
    [selectedCells],
  )
  const todayIso = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])
  const selectedDateSet = useMemo(() => {
    const dates = new Set()
    if (selectedCell?.date) dates.add(selectedCell.date)
    selectedCells.forEach((item) => {
      if (item?.date) dates.add(item.date)
    })
    return dates
  }, [selectedCell, selectedCells])
  const selectedEmployeeSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds])
  const hiddenEmployeesSet = useMemo(() => new Set(hiddenEmployees), [hiddenEmployees])
  const handleCellClickStable = useCallback((empId, date, e) => handleCellClick(empId, date, e), [handleCellClick])
  const handleTogglePosition = useCallback(
    (pos, checked) => {
      setPositionFilter((prev) => {
        if (checked) return prev.includes(pos) ? prev : [...prev, pos]
        return prev.filter((p) => p !== pos)
      })
    },
    [setPositionFilter],
  )
  const handleRemovePosition = useCallback(
    (pos) => setPositionFilter((prev) => prev.filter((p) => p !== pos)),
    [setPositionFilter],
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex flex-col gap-2">
          <Link
            to={personnelHref}
            onClick={(e) => {
              if (onBackToCard) {
                e.preventDefault()
                onBackToCard()
              }
            }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-sky-200 transition hover:border-sky-300 hover:text-sky-100"
            title="Назад к карточке персонала"
          >
            <span className="text-base leading-none">←</span>
            <span>· Персонал</span>
          </Link>
          <h3 className="text-lg font-semibold text-white">График работы персонала</h3>
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <span className="text-slate-300">за</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = new Date(monthStart)
                  d.setMonth(d.getMonth() - 1)
                  d.setDate(1)
                  setMonthStart(d.toISOString().slice(0, 10))
                }}
                className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-1 transition hover:border-sky-400/60"
              >
                ←
              </button>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white">
                {monthLabel}
              </span>
              <button
                onClick={() => {
                  const d = new Date(monthStart)
                  d.setMonth(d.getMonth() + 1)
                  d.setDate(1)
                  setMonthStart(d.toISOString().slice(0, 10))
                }}
                className="rounded-full border border-white/10 bg-slate-900 px-2.5 py-1 transition hover:border-sky-400/60"
              >
                →
              </button>
            </div>
          </div>
        </div>
        <div className="ml-auto flex w-full flex-col items-end gap-2 text-[11px] text-slate-200 md:w-auto md:min-w-[360px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                statusBadge.tone === 'error'
                  ? 'bg-rose-300'
                  : statusBadge.tone === 'info'
                    ? 'bg-slate-400'
                    : 'bg-emerald-400'
              }`}
            />
            {statusBadge.text}
          </span>
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Фильтры:</span>
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
                            onChange={(e) => handleTogglePosition(pos, e.target.checked)}
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
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <input
              value={filterQueryInput}
              onChange={(e) => setFilterQueryInput(e.target.value)}
              placeholder="Поиск ФИО"
              className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 md:w-[320px]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
                <button onClick={() => handleRemovePosition(pos)} className="text-slate-400 hover:text-white">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className="mt-2 relative isolate max-h-[70vh] overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 shadow-inner"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="w-full min-w-full table-fixed border-collapse text-[10px] text-slate-200 sm:min-w-[1100px] sm:text-xs">
          <thead className="z-30 bg-slate-950 sm:sticky" style={{ top: 0 }}>
            <tr>
              <th className="z-[35] w-32 bg-slate-950 px-2 py-1 text-left text-[10px] uppercase tracking-[0.18em] text-slate-400 shadow-[4px_0_12px_rgba(15,23,42,0.8)] sm:sticky sm:left-0 sm:w-44 sm:px-3 sm:py-1.5 sm:text-[11px]">
                Сотрудник
              </th>
              {monthDates.map((d) => {
                const dateObj = new Date(d)
                const dayNumber = dateObj.getDate()
                const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' })
                const isToday = d === todayIso
                const isSelectedDate = selectedDateSet.has(d)
                return (
                  <th
                    key={d}
                    className={`w-10 px-0.5 py-1 text-center text-[10px] uppercase tracking-[0.12em] sm:w-12 sm:px-1 sm:py-1.5 sm:text-[11px] ${
                      isSelectedDate && isToday
                        ? 'bg-gradient-to-b from-amber-300/15 to-sky-400/20 text-cyan-100'
                        : isSelectedDate
                          ? 'bg-sky-400/15 text-sky-100'
                          : isToday
                            ? 'bg-amber-300/15 text-amber-100'
                            : 'text-slate-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={`text-xs font-semibold sm:text-sm ${
                          isSelectedDate ? 'text-sky-100' : isToday ? 'text-amber-100' : 'text-white'
                        }`}
                      >
                        {dayNumber}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-[0.08em] sm:text-[10px] ${
                          isSelectedDate ? 'text-sky-200/90' : isToday ? 'text-amber-200/90' : 'text-slate-400'
                        }`}
                      >
                        {weekday}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {groupedByPosition.map((group) => {
              const collapsed = collapsedPositions.includes(group.position)
              return (
                <Fragment key={group.position}>
                  <tr className="bg-slate-900 border-t border-white/10">
                    <td
                      colSpan={1 + monthDates.length}
                      className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300"
                    >
                      <button
                        onClick={() =>
                          setCollapsedPositions((prev) =>
                            prev.includes(group.position) ? prev.filter((p) => p !== group.position) : [...prev, group.position],
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
                      const hiddenRow = hiddenEmployeesSet.has(emp.id)
                      return (
                        <tr key={`${group.position}-${emp.id}`} className={`border-t border-white/5 ${hiddenRow ? 'hidden' : ''}`}>
                          <td className="z-20 max-w-[220px] bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold text-white shadow-[4px_0_12px_rgba(15,23,42,0.8)] sm:sticky sm:left-0 sm:max-w-[240px] sm:px-3 sm:py-2 sm:text-sm">
                            <div className="relative flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setSelectedEmployeeIds((prev) => {
                                    const exists = prev.includes(emp.id)
                                    if (e.metaKey || e.ctrlKey) {
                                      if (exists) return prev.filter((id) => id !== emp.id)
                                      return [...prev, emp.id]
                                    }
                                    return exists ? [] : [emp.id]
                                  })
                                  setActionMenuRect({ top: rect.bottom + 4, left: rect.left })
                                }}
                                className={`origin-left text-left transition ${
                                  selectedEmployeeSet.has(emp.id)
                                    ? 'scale-[1.05] text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                                    : 'text-slate-100'
                                }`}
                                title={emp.label}
                              >
                                {emp.label}
                              </button>
                            </div>
                          </td>
                          {monthDates.map((d) => {
                            const key = `${emp.id}|${d}`
                            const cellEntries = scheduleByDay.get(`${emp.id}-${d}`) || []
                            const isSelected = selectedCellKey === key || selectedCellsSet.has(key)
                            const isToday = d === todayIso
                            const isSelectedDate = selectedDateSet.has(d)
                            return (
                              <ScheduleCell
                                key={key}
                                employeeId={emp.id}
                                date={d}
                                cellEntries={cellEntries}
                                selected={isSelected}
                                todayColumn={isToday}
                                selectedDateColumn={isSelectedDate}
                                formatCellValue={formatCellValue}
                                resolveIconType={resolveIconType}
                                iconCatalog={iconCatalog}
                                onClick={handleCellClickStable}
                              />
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
      {menuCell && typeof document !== 'undefined' &&
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
                <button onClick={() => setMenuCell(null)} className="no-spy-btn rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10">
                  ×
                </button>
              </div>
              <div
                className="flex max-h-60 flex-col gap-1 overflow-y-auto pr-1"
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {shiftOptions
                  .slice()
                  .sort((a, b) => (a.value === 'clear' ? 1 : b.value === 'clear' ? -1 : 0))
                  .map((opt) => {
                    const isClear = opt.value === 'clear'
                    return (
                        <button
                          key={opt.value}
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuCell(null)
                          if (applyShiftToSelected) {
                            void applyShiftToSelected(opt.value)
                          } else {
                            void handleApplyShift(selectedCell?.employeeId || 0, selectedCell?.date || '', opt.value)
                          }
                        }}
                        className={`no-spy-btn flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left transition ${
                          isClear
                            ? 'border-rose-300/60 bg-rose-900/40 text-rose-50 hover:border-rose-200 hover:bg-rose-800/60'
                            : 'border-white/10 bg-slate-800/80 text-slate-100 hover:border-sky-400/60 hover:bg-slate-800'
                        }`}
                      >
                        <span className={`text-[12px] font-semibold ${isClear ? 'text-rose-50' : ''}`}>{opt.label}</span>
                        <span className={`text-[10px] ${isClear ? 'text-rose-200/80' : 'text-slate-400'}`}>{opt.meta}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {selectedEmployeeIds.length > 0 &&
        actionMenuRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] pointer-events-none"
            onClick={() => {
              setSelectedEmployeeIds([])
              setActionMenuRect(null)
            }}
          >
            <div
              className="pointer-events-auto absolute w-48 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-[11px] text-slate-100 shadow-2xl"
              style={{ left: actionMenuRect.left, top: actionMenuRect.top }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-400">
                <span>Действия</span>
                <button
                  onClick={() => {
                    setSelectedEmployeeIds([])
                    setActionMenuRect(null)
                  }}
                  className="no-spy-btn rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => {
                  if (selectedEmployeeIds.length) {
                    setPinnedEmployees(selectedEmployeeIds)
                  }
                  setSelectedEmployeeIds([])
                  setActionMenuRect(null)
                }}
                className="no-spy-btn mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left transition hover:border-sky-400/60 hover:bg-slate-800"
              >
                Скрыть остальных ({selectedEmployeeIds.length})
              </button>
            </div>
          </div>,
          document.body,
        )}
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-200">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.15em] text-slate-400">
            <span>Свод по часам</span>
            <span className="text-slate-500">
              Норма (40ч): {hoursSummary.norm ? hoursSummary.norm.toFixed(1) : '—'} ч
            </span>
          </div>
          <div className="max-h-60 overflow-auto">
            <table className="w-full border-separate border-spacing-y-1">
              <thead className="text-[11px] text-slate-400">
                <tr>
                  <th className="text-left font-normal">Сотрудник</th>
                  <th className="text-right font-normal">Факт</th>
                  <th className="text-right font-normal">Норма</th>
                  <th className="text-right font-normal">Переработка</th>
                  <th className="text-right font-normal">Ночные</th>
                </tr>
              </thead>
              <tbody>
                {hoursSummary.rows.map((row) => (
                  <tr key={row.id} className="rounded">
                    <td className="truncate pr-2 text-slate-100" title={row.label}>
                      {row.label}
                    </td>
                    <td className="text-right font-semibold text-white">{row.totalHours.toFixed(1)}</td>
                    <td className="text-right text-slate-300">{row.adjustedNormHours.toFixed(1)}</td>
                    <td
                      className={`text-right font-semibold ${row.overtimeHours > 0 ? 'text-amber-300' : row.overtimeHours < 0 ? 'text-slate-300' : 'text-slate-300'}`}
                    >
                      {row.overtimeHours.toFixed(1)}
                    </td>
                    <td className="text-right text-slate-300">{row.nightHours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-200">
          <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">Итог месяца</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Всего часов</span>
              <span className="font-semibold text-white">{hoursSummary.totalHours.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Норма</span>
              <span className="font-semibold text-white">{hoursSummary.norm ? hoursSummary.norm.toFixed(1) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Дней по календарю</span>
              <span className="font-semibold text-white">{monthNorm?.workingDays || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Ночные часы</span>
              <span className="font-semibold text-slate-100">{hoursSummary.nightHours.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Праздничные/выходные</span>
              <span className="font-semibold text-slate-100">{hoursSummary.holidayHours.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Пересменка (30 мин/смена)</span>
              <span className="font-semibold text-slate-100">{hoursSummary.handoverHours.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Оплачиваемые часы</span>
              <span className="font-semibold text-white">{hoursSummary.payableHours.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Переработка суммарно (факт-норма)</span>
              <span className="font-semibold text-amber-300">
                {hoursSummary.overtimeTotal.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Норма учитывает праздники, переносы и сокращённые предпраздничные дни из `productionCalendar`.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-[11px] text-slate-100">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Как работать с графиком</p>
        <ul className="mt-2 grid gap-2 text-[11px] text-slate-200 md:grid-cols-2">
          <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="font-semibold text-white">Выбор смены:</span> кликайте по ячейке и выбирайте нужную смену в меню.
          </li>
          <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="font-semibold text-white">Множественный выбор:</span> зажмите Shift для диапазона или Ctrl/Cmd для отдельных ячеек, затем примените смену ко всем выбранным.
          </li>
          <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="font-semibold text-white">Скрытие/закрепление:</span> клик по ФИО, затем «Скрыть остальных» — оставит только выбранных.
          </li>
          <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="font-semibold text-white">Фильтры:</span> используйте блок фильтров сверху для категорий, отделений, должностей и поиска.
          </li>
        </ul>
      </div>
      {selectedCells.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Ячеек выделено: {selectedCells.length}</span>
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
  )
}

export default PersonnelSchedule
