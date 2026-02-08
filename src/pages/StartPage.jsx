import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useEmployeeProfile } from '../hooks/useEmployeeProfile'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { createScheduleService } from '../services/scheduleService'
import { createShiftHandoverService } from '../services/shiftHandoverService'
import ShiftHandoverPanel from '../components/ShiftHandoverPanel'

const updates = [
  {
    title: 'Плановый ремонт котла К-3 завершён',
    detail: 'Цех 2 · ФИО: В. Соколов',
    tag: 'Безопасность',
    time: '1 ч назад',
  },
  {
    title: 'Новый регламент ППР загружен',
    detail: 'Документы · Версия 2.1',
    tag: 'Документы',
    time: 'Сегодня',
  },
  {
    title: 'Открыт набор наставников для стажёров',
    detail: 'HR · Контакт: hr@tpp.local',
    tag: 'HR',
    time: 'Вчера',
  },
]

const ideas = [
  { author: 'А. Ким', text: 'Добавить контрольные списки для смен перед запуском котла', likes: 18 },
  { author: 'М. Гордеев', text: 'Собрать базу знаний по аварийным кейсам', likes: 23 },
  { author: 'Д. Литвин', text: 'Упростить маршрут согласований наряда', likes: 9 },
]

function StartPage() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const profile = useProfile()
  const scheduleService = useMemo(() => createScheduleService(supabase), [supabase])
  const handoverService = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const employeeProfile = useEmployeeProfile()
  const [probe, setProbe] = useState({ loading: true, result: null, error: '' })
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [employeesError, setEmployeesError] = useState('')
  const [scheduleToday, setScheduleToday] = useState([])
  const [handoverSession, setHandoverSession] = useState(null)
  const [handoverTopic, setHandoverTopic] = useState(null)
  const [handoverAssignments, setHandoverAssignments] = useState([])
  const [loadingHandover, setLoadingHandover] = useState(false)
  const [savingHandover, setSavingHandover] = useState(false)
  const [handoverError, setHandoverError] = useState('')
  const unitCode = 'ktc'
  const currentShiftDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const currentShiftType = useMemo(() => {
    const hour = new Date().getHours()
    return hour >= 20 || hour < 8 ? 'night' : 'day'
  }, [])

  const normalizeWorkplaceCode = useCallback((positionName = '') => {
    const normalized = String(positionName)
      .toLowerCase()
      .replace(/[^a-zA-Zа-яА-Я0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return normalized || 'general'
  }, [])

  const scopesForPosition = useCallback((positionName = '') => {
    const name = String(positionName).toLowerCase()
    if (name.includes('начальник смены')) return ['shift_control', 'operational_log', 'daily_statement']
    if (name.includes('машинист щита') || name.includes('старший машинист')) return ['operational_log', 'daily_statement']
    return ['daily_statement']
  }, [])

  const scheduleByDay = useMemo(() => {
    const map = new Map()
    scheduleToday.forEach((row) => {
      const key = `${row.employee_id}-${row.date}`
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    })
    return map
  }, [scheduleToday])

  const employeesFromSchedule = useMemo(() => {
    const map = new Map()
    scheduleToday.forEach((row) => {
      const label = row.employees
        ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
        : `ID ${row.employee_id}`
      map.set(row.employee_id, {
        id: row.employee_id,
        label,
        position: row.employees?.positions?.name || '',
      })
    })
    return Array.from(map.values())
  }, [scheduleToday])

  const buildDraftAssignments = useCallback(() => {
    return employeesFromSchedule
      .map((emp) => {
        const entries = scheduleByDay.get(`${emp.id}-${currentShiftDate}`) || []
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
  }, [currentShiftDate, employeesFromSchedule, normalizeWorkplaceCode, scheduleByDay, scopesForPosition])

  useEffect(() => {
    let active = true
    async function fetchProbe() {
      const { data, error } = await supabase.from('employees').select('id').limit(1)
      if (!active) return
      setProbe({ loading: false, result: data ?? null, error: error?.message ?? '' })
    }
    async function fetchEmployees() {
      setLoadingEmployees(true)
      setEmployeesError('')
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, middle_name, position_id')
        .limit(6)
      if (!active) return
      if (error) setEmployeesError(error.message)
      else setEmployees(data ?? [])
      setLoadingEmployees(false)
    }
    fetchProbe()
    fetchEmployees()
    return () => {
      active = false
    }
  }, [supabase])

  const loadHandoverData = useCallback(async () => {
    if (!user) return
    setLoadingHandover(true)
    setHandoverError('')
    const scheduleRes = await scheduleService.fetchRange({
      from: currentShiftDate,
      to: currentShiftDate,
      unit: unitCode,
    })
    if (scheduleRes.error) {
      setHandoverError(scheduleRes.error.message)
      setScheduleToday([])
      setLoadingHandover(false)
      return
    }
    setScheduleToday(scheduleRes.data || [])
    const [topicRes, sessionRes] = await Promise.all([
      handoverService.fetchTopicForDate({ unit: unitCode, shiftDate: currentShiftDate }),
      handoverService.fetchSession({ unit: unitCode, shiftDate: currentShiftDate, shiftType: currentShiftType }),
    ])
    setHandoverTopic(topicRes.data || null)
    const session = sessionRes.data || null
    setHandoverSession(session)
    if (session?.id) {
      const assRes = await handoverService.fetchAssignments({ sessionId: session.id })
      if (assRes.error) {
        setHandoverError((prev) => prev || assRes.error.message)
        setHandoverAssignments(buildDraftAssignments())
      } else {
        const mapById = new Map((scheduleRes.data || []).map((row) => {
          const label = row.employees
            ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
            : `ID ${row.employee_id}`
          return [row.employee_id, { label, position: row.employees?.positions?.name || '' }]
        }))
        setHandoverAssignments((assRes.data || []).map((row) => {
          const emp = mapById.get(row.employee_id)
          const positionName = row.position_name || emp?.position || ''
          return {
            ...row,
            employee_label: emp?.label || `ID ${row.employee_id}`,
            position_name: positionName,
            scopes: scopesForPosition(positionName),
            workplace_code: row.workplace_code || normalizeWorkplaceCode(positionName),
          }
        }))
      }
    } else {
      setHandoverAssignments(buildDraftAssignments())
    }
    setLoadingHandover(false)
  }, [
    buildDraftAssignments,
    currentShiftDate,
    currentShiftType,
    handoverService,
    normalizeWorkplaceCode,
    scheduleService,
    scopesForPosition,
    user,
  ])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      void loadHandoverData()
    }, 0)
    return () => clearTimeout(timer)
  }, [user, loadHandoverData])

  const handleStartHandover = async () => {
    if (!user || handoverSession) return
    setSavingHandover(true)
    setHandoverError('')
    const { data, error } = await handoverService.createSession({
      unit: unitCode,
      shift_date: currentShiftDate,
      shift_type: currentShiftType,
      status: 'handover',
      chief_employee_id: profile?.employee?.id || null,
      briefing_topic_id: handoverTopic?.id || null,
    })
    if (error) {
      setHandoverError(error.message)
      setSavingHandover(false)
      return
    }
    setHandoverSession(data)
    setHandoverAssignments((prev) => (prev.length ? prev : buildDraftAssignments()))
    setSavingHandover(false)
  }

  const handleAssignmentChange = useCallback((employeeId, patch) => {
    setHandoverAssignments((prev) => prev.map((row) => (row.employee_id === employeeId ? { ...row, ...patch } : row)))
  }, [])

  const handleConfirmHandover = async () => {
    if (!user || !handoverSession?.id) return
    setSavingHandover(true)
    setHandoverError('')
    const now = new Date().toISOString()
    const rows = handoverAssignments.map((row) => ({
      session_id: handoverSession.id,
      employee_id: row.employee_id,
      workplace_code: row.workplace_code || normalizeWorkplaceCode(row.position_name || ''),
      position_name: row.position_name || '',
      source: row.source || 'schedule',
      is_present: Boolean(row.is_present),
      note: row.note || null,
      confirmed_by_chief: true,
      confirmed_at: now,
    }))
    const upsertAssignments = await handoverService.upsertAssignments(rows)
    if (upsertAssignments.error) {
      setHandoverError(upsertAssignments.error.message)
      setSavingHandover(false)
      return
    }
    const permissionRows = rows
      .filter((row) => row.is_present)
      .flatMap((row) =>
        scopesForPosition(row.position_name).map((scope) => ({
          session_id: handoverSession.id,
          employee_id: row.employee_id,
          scope,
          workplace_code: row.workplace_code || '',
          granted_at: now,
          revoked_at: null,
          created_by: user.id,
        })),
      )
    if (permissionRows.length) {
      const upsertPermissions = await handoverService.upsertPermissions(permissionRows)
      if (upsertPermissions.error) {
        setHandoverError(upsertPermissions.error.message)
        setSavingHandover(false)
        return
      }
    }
    const upd = await handoverService.updateSession({
      sessionId: handoverSession.id,
      payload: { status: 'active', confirmed_at: now, confirmed_by: user.id },
    })
    if (upd.error) {
      setHandoverError(upd.error.message)
      setSavingHandover(false)
      return
    }
    setHandoverSession(upd.data || { ...handoverSession, status: 'active' })
    setSavingHandover(false)
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary to-primary-hover p-6 text-white shadow-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Смена · Инфопоток</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight">Привет, команда УИ-ТЭЦ</h2>
            <p className="max-w-2xl text-sm text-white/85">
              Быстрый доступ к сменным задачам, обновлениям, документам и идеям. Делитесь опытом, следите за
              безопасностью и держите курс на стабильную генерацию.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-white/85">
              <span className="rounded-full border border-eco/60 bg-eco/20 px-3 py-1 text-white">
                Рейтинг безопасности 98%
              </span>
              <span className="rounded-full border border-eco-dark/60 bg-eco-dark/30 px-3 py-1 text-white">
                Новые идеи: 12
              </span>
              <span className="rounded-full border border-warning/70 bg-warning/35 px-3 py-1 text-white">
                ППР на неделе: 6
              </span>
            </div>
          </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-xs text-white/70">Статус смены</p>
                <p className="text-lg font-semibold text-white">Смена S-24 активна</p>
                <p className="text-xs text-white/70">Диспетчер: М. Осипов</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-xs text-white/70">Коммуникации</p>
                <p className="text-lg font-semibold">49 сообщений</p>
                <p className="text-xs text-white/70">Новых за час: 7</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-xs text-white/70">Документы</p>
                <p className="text-lg font-semibold">+3 обновления</p>
                <p className="text-xs text-white/70">В работе: ППР, ОТиПБ</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-xs text-white/70">Серверы</p>
                <p className="text-lg font-semibold text-white">Все системы стабильны</p>
                <p className="text-xs text-white/70">API · База · VPN</p>
              </div>
            </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover">
            Запустить смену
          </button>
          <button className="rounded-full border border-white/40 px-5 py-2 text-sm text-white transition hover:border-white hover:text-white">
            Создать объявление
          </button>
          <button className="rounded-full border border-white/40 px-5 py-2 text-sm text-white transition hover:border-white hover:text-white">
            Быстрый наряд
          </button>
        </div>
      </div>

      <ShiftHandoverPanel
        unitCode={unitCode}
        shiftDate={currentShiftDate}
        chiefEmployee={profile?.employee}
        userId={user?.id}
        employeesFromSchedule={employeesFromSchedule}
        scheduleByDay={scheduleByDay}
        session={handoverSession}
        topic={handoverTopic}
        assignments={handoverAssignments}
        loading={loadingHandover}
        saving={savingHandover}
        error={handoverError}
        onStart={handleStartHandover}
        onReload={() => void loadHandoverData()}
        onConfirm={handleConfirmHandover}
        onChangeAssignment={handleAssignmentChange}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-grayText">Обновления</p>
              <h3 className="text-lg font-semibold">Лента смены</h3>
            </div>
            <button className="rounded-full border border-border px-3 py-1 text-xs text-dark transition hover:border-accent/70 hover:text-primary">
              Фильтр
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {updates.map((update) => (
              <div
                key={update.title}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40"
              >
                <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{update.title}</p>
                  <p className="text-xs text-grayText">{update.detail}</p>
                  <div className="flex gap-2 text-[11px] text-grayText">
                    <span className="rounded-full border border-border bg-background px-2 py-1">{update.tag}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-1">{update.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-grayText">Задачи</p>
              <h3 className="text-lg font-semibold">Ближайшие действия</h3>
            </div>
            <button className="rounded-full border border-border px-3 py-1 text-xs text-dark transition hover:border-accent/70 hover:text-primary">
              Добавить
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              { title: 'Проверка АСУТП котла К-4', detail: 'Ответственный: А. Романов', status: 'В работе' },
              { title: 'Согласование нарядов на 20.03', detail: 'Сменный начальник', status: 'На согласовании' },
              { title: 'Калибровка датчиков давления', detail: 'Турбинный цех', status: 'Запланировано' },
            ].map((task) => (
              <div
                key={task.title}
                className="rounded-xl border border-border bg-background p-4 transition hover:border-emerald-400/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-grayText">{task.detail}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">{task.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">Коммуникации</p>
            <h3 className="text-lg font-semibold">Идеи и предложения</h3>
          </div>
          <button className="rounded-full bg-white/10 px-3 py-1 text-xs text-dark transition hover:border-accent/70 hover:bg-primary/20">
            Предложить идею
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ideas.map((idea) => (
            <div
              key={idea.text}
              className="space-y-3 rounded-xl border border-border bg-background p-4 transition hover:border-accent/40"
            >
              <div className="flex flex-col gap-1 text-xs text-grayText sm:flex-row sm:items-center sm:justify-between">
                <span>{idea.author}</span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">{idea.likes} ▲</span>
              </div>
              <p className="text-sm leading-relaxed text-dark">{idea.text}</p>
              <button className="w-full rounded-lg border border-border px-3 py-2 text-xs text-dark transition hover:border-accent/70 hover:text-primary">
                Взять в работу
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 text-sm text-dark">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-grayText">Ваш профиль</p>
            <p className="text-base font-semibold text-dark">Связь с кадровой записью</p>
          </div>
          {employeeProfile.loading && <span className="text-xs text-grayText">загрузка…</span>}
        </div>
        {employeeProfile.error && <p className="text-xs text-orange-300">Ошибка: {employeeProfile.error}</p>}
        {employeeProfile.employee && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">ФИО</p>
              <p className="text-sm font-semibold text-dark">
                {[employeeProfile.employee.last_name, employeeProfile.employee.first_name, employeeProfile.employee.middle_name]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Должность</p>
              <p className="text-sm font-semibold text-dark">
                {employeeProfile.employee.positions?.name || employeeProfile.employee.position_id || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Пост / участок</p>
              <p className="text-sm font-semibold text-dark">—</p>
            </div>
          </div>
        )}
        {!employeeProfile.loading && !employeeProfile.employee && !employeeProfile.error && (
          <p className="mt-2 text-xs text-grayText">Нет привязки к сотруднику. Обновите в профиле.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 text-xs text-grayText">
        <p className="text-[11px] uppercase tracking-[0.25em] text-grayText">Supabase probe (dev)</p>
        {probe.loading && <p>Загрузка...</p>}
        {!probe.loading && probe.result && <p>employees id: {probe.result?.[0]?.id ?? 'нет данных'}</p>}
        {!probe.loading && probe.error && <p className="text-orange-300">Ошибка: {probe.error}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 text-sm text-dark">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-grayText">Команда</p>
            <p className="text-base font-semibold text-dark">Сотрудники (employees)</p>
          </div>
          {loadingEmployees && <span className="text-xs text-grayText">загрузка…</span>}
        </div>
        {employeesError && <p className="text-xs text-orange-300">Ошибка: {employeesError}</p>}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {employees.map((emp) => {
            const fio = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ')
            const position = emp.positions?.name || emp.position_id || '—'
            return (
              <div key={emp.id} className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-semibold text-dark">{fio || emp.id}</p>
                <p className="text-xs text-grayText">Должность: {position}</p>
              </div>
            )
          })}
          {!loadingEmployees && !employeesError && employees.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background p-3 text-xs text-grayText">
              Нет записей в employees.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StartPage
