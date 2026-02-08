const HOURS_PER_WORKDAY = 8

const normalizeSet = (list = []) => new Set((list || []).filter(Boolean))

const toIsoDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)

const isWeekendIso = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export function getMonthCalendarMeta({ year, month, calendar }) {
  const monthData = calendar?.[year]?.[month] || {}
  const holidays = normalizeSet(monthData.holidays)
  const workingWeekends = normalizeSet(monthData.workingWeekends)
  const shortDays = normalizeSet(monthData.shortDays)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const isWorkingDay = (isoDate) => {
    if (workingWeekends.has(isoDate)) return true
    if (holidays.has(isoDate)) return false
    return !isWeekendIso(isoDate)
  }

  let workingDays = 0
  let shortDayCount = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIsoDate(year, month, day)
    if (!isWorkingDay(iso)) continue
    workingDays += 1
    if (shortDays.has(iso)) shortDayCount += 1
  }

  const explicitNorm = monthData.normHours40
  const legacyNorm = monthData.workingHours
  const normHours =
    Number.isFinite(explicitNorm)
      ? explicitNorm
      : Number.isFinite(legacyNorm)
        ? legacyNorm
        : workingDays * HOURS_PER_WORKDAY - shortDayCount

  return {
    year,
    month,
    workingDays,
    shortDayCount,
    normHours,
    holidays,
    workingWeekends,
    shortDays,
    isWorkingDay,
  }
}

const getEntryHours = (entry) => {
  const value = Number(entry?.planned_hours)
  return Number.isFinite(value) ? value : 0
}

const isNightEntry = (entry) => {
  const source = String(entry?.source || '').toLowerCase()
  const note = String(entry?.note || '').toLowerCase()
  return source.includes('night') || note.includes('ноч') || note.includes('отсып')
}

const isNormReductionEntry = (entry) => {
  const source = String(entry?.source || '').toLowerCase()
  const note = String(entry?.note || '').toLowerCase()
  return (
    source.includes('vacation') ||
    source.includes('sick') ||
    source.includes('maternity') ||
    note.includes('отпуск') ||
    note.includes('больнич') ||
    note.includes('декрет')
  )
}

const isShiftLikeEntry = (entry) => {
  const hours = getEntryHours(entry)
  if (hours <= 0) return false
  const source = String(entry?.source || '').toLowerCase()
  const note = String(entry?.note || '').toLowerCase()
  if (source === 'off' || source.includes('vacation') || source.includes('sick') || source.includes('maternity')) {
    return false
  }
  if (note.includes('отпуск') || note.includes('больнич') || note.includes('декрет') || note.includes('выходной')) {
    return false
  }
  return true
}

const isNightShiftStart = (entry) => {
  const note = String(entry?.note || '').toLowerCase()
  const hours = Math.round(getEntryHours(entry))
  if (note.includes('часть 2') || note.includes('отсыпной после ночи')) return false
  if (note.includes('часть 1')) return true
  if (hours === 3) return true
  return true
}

export function calculateEmployeeMonthStats({
  employeeId,
  monthDates,
  scheduleByDay,
  calendarMeta,
  handoverMinutes = 30,
}) {
  const id = String(employeeId)
  let totalHours = 0
  let nightHours = 0
  let holidayHours = 0
  let shiftCount = 0
  let normReductionHours = 0

  monthDates.forEach((date) => {
    const dayEntries = scheduleByDay.get(`${id}-${date}`) || []
    const dayTotal = dayEntries.reduce((acc, entry) => acc + getEntryHours(entry), 0)
    totalHours += dayTotal

    if (!calendarMeta.isWorkingDay(date) && dayTotal > 0) {
      holidayHours += dayTotal
    }

    const hasNormReduction = dayEntries.some(isNormReductionEntry)
    if (hasNormReduction && calendarMeta.isWorkingDay(date)) {
      normReductionHours += HOURS_PER_WORKDAY
    }

    dayEntries.forEach((entry) => {
      const entryHours = getEntryHours(entry)
      if (entryHours <= 0) return
      if (isNightEntry(entry)) {
        nightHours += entryHours
      }
      if (!isShiftLikeEntry(entry)) return
      if (isNightEntry(entry) && !isNightShiftStart(entry)) return
      shiftCount += 1
    })
  })

  const handoverHours = shiftCount * (handoverMinutes / 60)
  const adjustedNormHours = Math.max(0, calendarMeta.normHours - normReductionHours)
  const overtimeHours = totalHours - adjustedNormHours
  const payableHours = totalHours + handoverHours

  return {
    totalHours,
    adjustedNormHours,
    overtimeHours,
    nightHours,
    holidayHours,
    shiftCount,
    handoverHours,
    payableHours,
    normReductionHours,
  }
}

