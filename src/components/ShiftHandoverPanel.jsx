import { useMemo, useState } from 'react'

const normalizeWorkplaceCode = (positionName = '') => {
  const normalized = String(positionName)
    .toLowerCase()
    .replace(/[^a-zA-Zа-яА-Я0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'general'
}

const scopesForPosition = (positionName = '') => {
  const name = String(positionName).toLowerCase()
  if (name.includes('начальник смены')) {
    return ['shift_control', 'operational_log', 'daily_statement']
  }
  if (name.includes('машинист щита') || name.includes('старший машинист')) {
    return ['operational_log', 'daily_statement']
  }
  return ['daily_statement']
}

function ShiftHandoverPanel({
  unitCode,
  shiftDate,
  chiefEmployee,
  userId,
  employeesFromSchedule,
  scheduleByDay,
  session,
  topic,
  assignments,
  loading,
  saving,
  error,
  onStart,
  onReload,
  onConfirm,
  onChangeAssignment,
}) {
  const [filterOnlyPresent, setFilterOnlyPresent] = useState(true)
  const isChief = Boolean(chiefEmployee?.positions?.name?.toLowerCase().includes('начальник смены'))
  const canManage = Boolean(isChief && userId)

  const fallbackAssignments = useMemo(() => {
    return employeesFromSchedule
      .map((emp) => {
        const entries = scheduleByDay.get(`${emp.id}-${shiftDate}`) || []
        const hasWork = entries.some((e) => Number(e?.planned_hours || 0) > 0)
        if (!hasWork) return null
        return {
          employee_id: emp.id,
          employee_label: emp.label,
          position_name: emp.position || '',
          workplace_code: normalizeWorkplaceCode(emp.position || ''),
          is_present: true,
          note: '',
          scopes: scopesForPosition(emp.position || ''),
        }
      })
      .filter(Boolean)
  }, [employeesFromSchedule, scheduleByDay, shiftDate])

  const rows = assignments?.length ? assignments : fallbackAssignments
  const visibleRows = filterOnlyPresent ? rows.filter((r) => r.is_present) : rows

  return (
    <div className="rounded-2xl border border-border bg-surface/95 p-4 text-sm text-dark shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-grayText">Приемка смены</p>
          <p className="text-base font-semibold text-dark">{unitCode?.toUpperCase()} · {shiftDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
            session?.status === 'active'
              ? 'border-eco/60 bg-eco-light/70 text-accent'
              : 'border-warning/60 bg-warning-light text-amber-100'
          }`}>
            {session?.status === 'active' ? 'Подтверждено' : 'Ожидает подтверждения'}
          </span>
          <button
            onClick={onReload}
            className="no-spy-btn rounded-full border border-border px-3 py-1 text-xs text-grayText transition hover:border-accent/60 hover:text-accent"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-background/80 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Тема инструктажа</p>
        <p className="mt-1 text-sm text-dark">{topic?.topic || 'Тема не задана на текущую дату/месяц'}</p>
        {topic?.materials && <p className="mt-1 text-xs text-grayText">{topic.materials}</p>}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-warning/50 bg-warning-light px-3 py-2 text-xs text-amber-100">
          Ошибка: {error}
        </p>
      )}

      {!session && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            disabled={!canManage || loading || saving}
            onClick={onStart}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {loading || saving ? 'Создаем...' : 'Начать приемку смены'}
          </button>
          {!canManage && (
            <span className="text-xs text-grayText">Только начальник смены может начать приемку.</span>
          )}
        </div>
      )}

      {!!session && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">
              Состав по рабочим местам ({visibleRows.length})
            </p>
            <label className="flex items-center gap-2 text-xs text-grayText">
              <input
                type="checkbox"
                checked={filterOnlyPresent}
                onChange={(e) => setFilterOnlyPresent(e.target.checked)}
              />
              Показать только присутствующих
            </label>
          </div>

          <div className="mt-2 max-h-60 overflow-auto rounded-xl border border-border bg-background/70">
            <table className="w-full text-xs">
              <thead className="bg-background/95 text-grayText">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Сотрудник</th>
                  <th className="px-3 py-2 text-left font-medium">Раб. место</th>
                  <th className="px-3 py-2 text-left font-medium">Права</th>
                  <th className="px-3 py-2 text-left font-medium">Присутствие</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.employee_id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-dark">{row.employee_label || row.employee_id}</td>
                    <td className="px-3 py-2">
                      <input
                        disabled={!canManage || session.status === 'active'}
                        value={row.workplace_code || ''}
                        onChange={(e) => onChangeAssignment(row.employee_id, { workplace_code: e.target.value })}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-dark outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-grayText">{(row.scopes || scopesForPosition(row.position_name)).join(', ')}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={!canManage || session.status === 'active'}
                        checked={Boolean(row.is_present)}
                        onChange={(e) => onChangeAssignment(row.employee_id, { is_present: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td className="px-3 py-2 text-grayText" colSpan={4}>Нет сотрудников по графику на выбранную дату.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              disabled={!canManage || saving || session.status === 'active' || !rows.length}
              onClick={onConfirm}
              className="rounded-full bg-eco px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? 'Сохраняем...' : 'Подтвердить состав и открыть права'}
            </button>
            {session?.status === 'active' && (
              <span className="text-xs text-grayText">Смена подтверждена: права выданы персоналу.</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ShiftHandoverPanel

