import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useEmployeeProfile } from '../hooks/useEmployeeProfile'

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
  const employeeProfile = useEmployeeProfile()
  const [probe, setProbe] = useState({ loading: true, result: null, error: '' })
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [employeesError, setEmployeesError] = useState('')

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

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-900/70 p-6 shadow-2xl shadow-sky-900/10 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Смена · Инфопоток</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight">Привет, команда УИ-ТЭЦ</h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Быстрый доступ к сменным задачам, обновлениям, документам и идеям. Делитесь опытом, следите за
              безопасностью и держите курс на стабильную генерацию.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                Рейтинг безопасности 98%
              </span>
              <span className="rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-sky-100">
                Новые идеи: 12
              </span>
              <span className="rounded-full border border-orange-400/60 bg-orange-500/10 px-3 py-1 text-orange-100">
                ППР на неделе: 6
              </span>
            </div>
          </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Статус смены</p>
                <p className="text-lg font-semibold text-emerald-200">Смена S-24 активна</p>
                <p className="text-xs text-slate-400">Диспетчер: М. Осипов</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Коммуникации</p>
                <p className="text-lg font-semibold">49 сообщений</p>
                <p className="text-xs text-slate-400">Новых за час: 7</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Документы</p>
                <p className="text-lg font-semibold">+3 обновления</p>
                <p className="text-xs text-slate-400">В работе: ППР, ОТиПБ</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">Серверы</p>
                <p className="text-lg font-semibold text-emerald-200">Все системы стабильны</p>
                <p className="text-xs text-slate-400">API · База · VPN</p>
              </div>
            </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
            Запустить смену
          </button>
          <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white">
            Создать объявление
          </button>
          <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white">
            Быстрый наряд
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Обновления</p>
              <h3 className="text-lg font-semibold">Лента смены</h3>
            </div>
            <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-sky-400/70 hover:text-white">
              Фильтр
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {updates.map((update) => (
              <div
                key={update.title}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-sky-400/40"
              >
                <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{update.title}</p>
                  <p className="text-xs text-slate-400">{update.detail}</p>
                  <div className="flex gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full bg-slate-800 px-2 py-1">{update.tag}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-1">{update.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Задачи</p>
              <h3 className="text-lg font-semibold">Ближайшие действия</h3>
            </div>
            <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-sky-400/70 hover:text-white">
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
                className="rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-emerald-400/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-slate-400">{task.detail}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">{task.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Коммуникации</p>
            <h3 className="text-lg font-semibold">Идеи и предложения</h3>
          </div>
          <button className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/70 hover:bg-sky-500/20">
            Предложить идею
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ideas.map((idea) => (
            <div
              key={idea.text}
              className="space-y-3 rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-sky-400/40"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{idea.author}</span>
                <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] text-sky-100">{idea.likes} ▲</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-100">{idea.text}</p>
              <button className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white">
                Взять в работу
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Ваш профиль</p>
            <p className="text-base font-semibold text-white">Связь с кадровой записью</p>
          </div>
          {employeeProfile.loading && <span className="text-xs text-slate-400">загрузка…</span>}
        </div>
        {employeeProfile.error && <p className="text-xs text-orange-300">Ошибка: {employeeProfile.error}</p>}
        {employeeProfile.employee && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">ФИО</p>
              <p className="text-sm font-semibold text-white">
                {[employeeProfile.employee.last_name, employeeProfile.employee.first_name, employeeProfile.employee.middle_name]
                  .filter(Boolean)
                  .join(' ') || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Должность</p>
              <p className="text-sm font-semibold text-white">
                {employeeProfile.employee.positions?.name || employeeProfile.employee.position_id || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Пост / участок</p>
              <p className="text-sm font-semibold text-white">—</p>
            </div>
          </div>
        )}
        {!employeeProfile.loading && !employeeProfile.employee && !employeeProfile.error && (
          <p className="mt-2 text-xs text-slate-400">Нет привязки к сотруднику. Обновите в профиле.</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-xs text-slate-300">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Supabase probe (dev)</p>
        {probe.loading && <p>Загрузка...</p>}
        {!probe.loading && probe.result && <p>employees id: {probe.result?.[0]?.id ?? 'нет данных'}</p>}
        {!probe.loading && probe.error && <p className="text-orange-300">Ошибка: {probe.error}</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Команда</p>
            <p className="text-base font-semibold text-white">Сотрудники (employees)</p>
          </div>
          {loadingEmployees && <span className="text-xs text-slate-400">загрузка…</span>}
        </div>
        {employeesError && <p className="text-xs text-orange-300">Ошибка: {employeesError}</p>}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {employees.map((emp) => {
            const fio = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ')
            const position = emp.positions?.name || emp.position_id || '—'
            return (
              <div key={emp.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{fio || emp.id}</p>
                <p className="text-xs text-slate-400">Должность: {position}</p>
              </div>
            )
          })}
          {!loadingEmployees && !employeesError && employees.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              Нет записей в employees.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StartPage
