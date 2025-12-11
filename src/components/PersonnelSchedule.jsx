import { Fragment, memo, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import Badge from './Badge'

const ScheduleCell = memo(function ScheduleCell({
  employeeId,
  date,
  cellEntries,
  selected,
  formatCellValue,
  resolveIconType,
  iconCatalog,
  ShiftIcon,
  onClick,
}) {
  const displayValue = useMemo(() => formatCellValue(cellEntries), [cellEntries, formatCellValue])
  const pentagramType = useMemo(() => resolveIconType(cellEntries), [cellEntries, resolveIconType])
  const pentagramMeta = pentagramType ? iconCatalog[pentagramType] : null

  return (
    <td
      onClick={(e) => onClick(employeeId, date, e)}
      className={`relative cursor-pointer px-1 py-1 align-top transition hover:bg-sky-500/10 ${
        selected ? 'bg-sky-500/10' : ''
      }`}
    >
      <div
        className={`relative flex min-h-[44px] items-end justify-center rounded border bg-white/5 px-3 pt-4 pb-1 text-[11px] font-semibold text-slate-100 transition ${
          selected
            ? 'cell-selected border-transparent bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-slate-900/70 shadow-[0_12px_32px_rgba(56,189,248,0.25)] ring-2 ring-sky-300/60 ring-offset-1 ring-offset-slate-900'
            : 'border-white/10'
        }`}
        title={pentagramMeta?.title || ''}
      >
        {pentagramMeta && (
          <span className="absolute right-1.5 top-1.5 opacity-70">
            <ShiftIcon
              type={pentagramMeta.icon}
              color={pentagramMeta.color}
              glow={pentagramMeta.glow}
              size={14}
              title={pentagramMeta.title}
              minimal
            />
          </span>
        )}
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
    setHiddenEmployees,
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
    selectedCell,
    selectedCells,
    handleCellClick,
    handleApplyShift,
    applyShiftToSelected,
    setSelectionAnchor,
    setMenuCell,
    menuCell,
    shiftMenuPosition,
    shiftOptions,
    pentagramTypesInSchedule,
    isPersonnel,
    ShiftIcon,
    onBackToCard,
  } = props

  const heading = useMemo(() => (isPersonnel ? 'Календарь смен персонала' : 'График'), [isPersonnel])
  const personnelHref = useMemo(() => (unitCode ? `/${unitCode}/personnel` : '#'), [unitCode])
  const watchOptions = useMemo(() => ['А', 'Б', 'В', 'Г'], [])
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
  const toUtcDate = (iso) => {
    const [year, month, day] = iso.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  const watchCycle = useMemo(
    () => [
      { crew: 'Г', part: 'День' },
      { crew: 'Б', part: 'Ночь' },
      { crew: 'А', part: 'День' },
      { crew: 'Г', part: 'Ночь' },
      { crew: 'В', part: 'День' },
      { crew: 'А', part: 'Ночь' },
      { crew: 'Б', part: 'День' },
      { crew: 'В', part: 'Ночь' },
    ],
    [],
  )
  const getWatchForDate = useCallback(
    (dateStr) => {
      const anchor = toUtcDate('2025-12-30') // вахта А (день) базовая точка
      const current = toUtcDate(dateStr)
      const diffDays = Math.floor((current - anchor) / (1000 * 60 * 60 * 24))
      const idx = ((diffDays % watchCycle.length) + watchCycle.length) % watchCycle.length
      return watchCycle[idx]
    },
    [watchCycle],
  )
  const legendTypes = useMemo(() => {
    const base = Object.keys(iconCatalog || {})
    const set = new Set(base)
    pentagramTypesInSchedule.forEach((t) => set.add(t))
    return Array.from(set)
  }, [pentagramTypesInSchedule, iconCatalog])
  const [actionMenuRect, setActionMenuRect] = useState(null)
  const selectedCellKey = selectedCell ? `${selectedCell.employeeId}|${selectedCell.date}` : null
  const selectedCellsSet = useMemo(
    () => new Set(selectedCells.map((c) => `${c.employeeId}|${c.date}`)),
    [selectedCells],
  )
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
        <div className="ml-auto flex items-start justify-end text-[11px] text-slate-200">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
              statusBadge.tone === 'error'
                ? 'border border-rose-300/60 bg-rose-500/15 text-rose-100'
                : statusBadge.tone === 'info'
                  ? 'border border-sky-300/60 bg-sky-500/15 text-sky-50'
                  : 'border border-emerald-300/50 bg-emerald-500/15 text-emerald-50'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {statusBadge.text}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-[11px] text-slate-200">
        <div className="flex flex-wrap items-center gap-2">
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
              <button onClick={() => handleRemovePosition(pos)} className="text-slate-400 hover:text-white">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 relative isolate max-h-[70vh] overflow-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1200px] table-fixed border-separate border-spacing-0 text-xs text-slate-200">
          <thead className="sticky z-30 bg-slate-900/95 backdrop-blur" style={{ top: 0 }}>
            <tr>
              <th className="sticky left-0 z-[35] w-44 bg-slate-900/95 px-3 py-1.5 text-left text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Сотрудник
              </th>
              {monthDates.map((d) => {
                const dateObj = new Date(d)
                const dayNumber = dateObj.getDate()
                const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' })
                const watch = getWatchForDate(d)
                return (
                  <th key={d} className="w-12 px-1 py-1.5 text-center text-[11px] uppercase tracking-[0.15em] text-slate-300">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-semibold text-white">{dayNumber}</span>
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400">{weekday}</span>
                      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[10px] font-semibold text-slate-100">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
                        {watch.crew}
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
                  <tr className="bg-slate-900/60 border-t border-white/10">
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
                          <td className="sticky left-0 z-20 max-w-[240px] bg-slate-900/95 px-3 py-2 text-left text-sm font-semibold text-white">
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
                            return (
                              <ScheduleCell
                                key={key}
                                employeeId={emp.id}
                                date={d}
                                cellEntries={cellEntries}
                                selected={isSelected}
                                formatCellValue={formatCellValue}
                                resolveIconType={resolveIconType}
                                iconCatalog={iconCatalog}
                                ShiftIcon={ShiftIcon}
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
                <button onClick={() => setMenuCell(null)} className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10">
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
                          if (applyShiftToSelected) {
                            applyShiftToSelected(opt.value)
                          } else {
                            handleApplyShift(selectedCell?.employeeId || 0, selectedCell?.date || '', opt.value)
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left transition ${
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
                  className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/10"
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
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left transition hover:border-sky-400/60 hover:bg-slate-800"
              >
                Скрыть остальных ({selectedEmployeeIds.length})
              </button>
            </div>
          </div>,
          document.body,
        )}
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
