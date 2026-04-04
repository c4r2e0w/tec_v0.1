import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSupabase } from '../context/SupabaseProvider'
import WeatherWidget from './WeatherWidget'

const units = [
  { key: 'ktc', title: 'Котлотурбинный цех', icon: '🔥' },
  { key: 'chem', title: 'Химический цех', icon: '⚗️' },
  { key: 'electro', title: 'Электроцех', icon: '⚡️' },
  { key: 'sai', title: 'Цех автоматики и измерений', icon: '📡' },
  { key: 'fuel', title: 'Цех топливоподачи', icon: '⛽️' },
]

function Layout({ children }) {
  const { user } = useAuth()
  const supabase = useSupabase()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [openUnit, setOpenUnit] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [workplaceCrumbLabel, setWorkplaceCrumbLabel] = useState('')
  const location = useLocation()
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.key, u.title])), [])
  const currentUnit = useMemo(() => {
    const pathUnit = location.pathname.split('/').filter(Boolean)[0]
    return unitMap[pathUnit] || null
  }, [location.pathname, unitMap])
  const mainOffset = 'md:ml-64'
  const isEmbedMode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('embed') === '1'
  }, [location.search])
  const sectionMap = useMemo(
    () => ({
      personnel: 'Персонал',
      equipment: 'Оборудование',
      docs: 'Документация',
    }),
    [],
  )
  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    const list = [{ to: '/', label: 'Главная' }]
    if (!parts.length) return list

    const withLabel = (to, label) => ({ to, label })

    if (parts[0] === 'login') return [withLabel('/login', 'Вход')]
    if (parts[0] === 'profile') return [...list, withLabel('/profile', 'Профиль')]
    if (parts[0] === 'hub') return [...list, withLabel('/hub', 'Лента')]
    if (parts[0] === 'union') return [...list, withLabel('/union', 'Профсоюз')]
    if (parts[0] === 'training') return [...list, withLabel('/training', 'Обучение')]
    if (parts[0] === 'equipment') return [...list, withLabel('/equipment', 'База оборудования')]
    if (parts[0] === 'roster') return [...list, withLabel('/roster', 'График')]
    if (parts[0] === 'topics') return [...list, withLabel('/topics', 'Темы смен')]
    if (parts[0] === 'shift' && parts[1] === 'today') return [...list, withLabel('/shift/today', 'Смена сегодня')]
    if (parts[0] === 'rounds' && parts[1] === 'today') return [...list, withLabel('/rounds/today', 'Обход сегодня')]
    if (parts[0] === 'rounds' && parts[1] === 'history') return [...list, withLabel('/rounds/history', 'История обходов')]
    if (parts[0] === 'rounds' && parts[1]) return [...list, withLabel('/rounds/today', 'Обходы'), withLabel(`/rounds/${parts[1]}`, `Обход #${parts[1]}`)]
    if (parts[0] === 'people' && parts[1]) return [...list, withLabel('/hub', 'Лента'), withLabel(`/people/${parts[1]}`, `Сотрудник #${parts[1]}`)]
    if (parts[0] === 'workplaces' && parts[1] && parts[2]) {
      const unitTitle = unitMap[parts[1]] || parts[1].toUpperCase()
      const wpLabel = workplaceCrumbLabel || `Рабочее место #${parts[2]}`
      return [...list, withLabel(`/${parts[1]}`, unitTitle), withLabel(`/${parts[1]}/personnel`, 'Персонал'), withLabel(`/workplaces/${parts[1]}/${parts[2]}`, wpLabel)]
    }
    if (unitMap[parts[0]]) {
      const unitTitle = unitMap[parts[0]]
      const section = parts[1]
      const sectionLabel = section ? sectionMap[section] || section : null
      if (!sectionLabel) return [...list, withLabel(`/${parts[0]}`, unitTitle)]
      return [...list, withLabel(`/${parts[0]}`, unitTitle), withLabel(`/${parts[0]}/${section}`, sectionLabel)]
    }

    return [...list, withLabel(location.pathname, decodeURIComponent(parts[parts.length - 1] || 'Раздел'))]
  }, [location.pathname, sectionMap, unitMap, workplaceCrumbLabel])

  const handleLogin = () => navigate('/login')
  const handleProfile = () => navigate('/profile')
  const handleLogout = async () => {
    await supabase?.auth?.signOut()
    navigate('/login')
    setMobileNavOpen(false)
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    async function loadWorkplaceCrumb() {
      const parts = location.pathname.split('/').filter(Boolean)
      if (!(parts[0] === 'workplaces' && parts[1] && parts[2])) {
        setWorkplaceCrumbLabel('')
        return
      }
      const unit = parts[1]
      const workplaceId = parts[2]
      const res = await supabase
        .from('workplace')
        .select('id, name, code')
        .eq('unit', unit)
        .eq('id', Number(workplaceId))
        .maybeSingle()
      if (!active) return
      setWorkplaceCrumbLabel(res?.data?.name || res?.data?.code || `Рабочее место #${workplaceId}`)
    }
    void loadWorkplaceCrumb()
    return () => {
      active = false
    }
  }, [location.pathname, supabase])

  const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Irkutsk',
  })

  const navContent = (
    <nav className="flex flex-col gap-5 text-sm text-grayText">
      {user && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-grayText">Подразделения</p>
          {units.map((unit) => {
            const expanded = openUnit === unit.key
            return (
              <div key={unit.key} className="rounded-xl border border-border bg-surface/90 shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
                <button
                  onClick={() => {
                    setOpenUnit(expanded ? null : unit.key)
                    navigate(`/${unit.key}`)
                    setMobileNavOpen(false)
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-dark transition hover:border-accent/40 hover:text-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center text-base">{unit.icon}</span>
                    <span>{unit.title}</span>
                  </span>
                  <span className="text-xs text-grayText">{expanded ? '–' : '+'}</span>
                </button>
                {expanded && (
                  <div className="flex flex-col gap-1 border-t border-border p-2">
                    {['personnel', 'equipment', 'docs'].map((section) => (
                      <NavLink
                        key={section}
                        to={`/${unit.key}/${section}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          [
                            'rounded-lg border px-4 py-2 text-sm transition',
                            isActive
                              ? 'border-accent/60 bg-primary/25 text-accent shadow-sm shadow-accent/10'
                              : 'border-transparent text-grayText hover:border-accent/35 hover:bg-background hover:text-dark',
                          ].join(' ')
                        }
                      >
                        {section === 'personnel' && 'Персонал'}
                        {section === 'equipment' && 'Оборудование'}
                        {section === 'docs' && 'Документация'}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {user && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-grayText">Аккаунт</p>
          <div className="flex flex-col gap-2">
            <NavLink
              to="/"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-primary/20 text-accent border border-accent/60 shadow-sm shadow-accent/10'
                    : 'border border-border hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">🏠</span>
                <span>Главная</span>
              </span>
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-primary/20 text-accent border border-accent/60 shadow-sm shadow-accent/10'
                    : 'border border-border hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">👤</span>
                <span>Профиль</span>
              </span>
            </NavLink>
            <NavLink
              to="/union"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-eco-light/70 text-accent border border-eco/60 shadow-sm shadow-eco/10'
                    : 'border border-border hover:border-eco/40 hover:text-eco',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">🏅</span>
                <span>Профсоюз</span>
              </span>
            </NavLink>
            <NavLink
              to="/training"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-primary/20 text-accent border border-accent/60 shadow-sm shadow-accent/10'
                    : 'border border-border hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">🎓</span>
                <span>Обучение</span>
              </span>
            </NavLink>
            <NavLink
              to="/rounds/today"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-primary/20 text-accent border border-accent/60 shadow-sm shadow-accent/10'
                    : 'border border-border hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">📝</span>
                <span>Обходы</span>
              </span>
            </NavLink>
            <NavLink
              to="/rounds/history"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-primary/20 text-accent border border-accent/60 shadow-sm shadow-accent/10'
                    : 'border border-border hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">📚</span>
                <span>История обходов</span>
              </span>
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  )

  if (isEmbedMode) {
    return (
      <div className="min-h-screen bg-background text-dark">
        <main className="px-2 py-2">
          <div className="mx-auto max-w-none">{children}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen bg-background text-dark">
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-10 top-24 h-72 w-72 rounded-full bg-eco/10 blur-3xl" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border bg-surface/95 px-6 py-8 shadow-[0_18px_38px_rgba(0,0,0,0.45)] backdrop-blur md:flex">
        <div
          onClick={() => navigate('/')}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-1 transition hover:border-accent/40"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-semibold text-white">
            УИ
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-grayText">УИ-ТЭЦ портал</p>
            <p className="text-sm font-semibold text-dark">Инфо · Соц · Работа</p>
          </div>
        </div>
        {navContent}
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-dark/40 transition-opacity duration-200 md:hidden ${mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex-col gap-6 border-r border-border bg-surface/95 px-6 py-8 shadow-[0_18px_38px_rgba(0,0,0,0.45)] backdrop-blur transition-transform duration-200 md:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between">
          <div
            onClick={() => {
              navigate('/')
              setMobileNavOpen(false)
            }}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-1 transition hover:border-accent/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-semibold text-white">
              УИ
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-grayText">УИ-ТЭЦ портал</p>
              <p className="text-sm font-semibold text-dark">Инфо · Соц · Работа</p>
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Закрыть меню"
            className="rounded-full border border-border bg-background px-3 py-1 text-sm text-dark transition hover:border-accent/60 hover:text-accent"
          >
            ✕
          </button>
        </div>
        {navContent}
      </aside>

      <div className={`relative z-10 flex flex-1 flex-col ${mainOffset}`}>
        <header className="sticky top-0 flex flex-col gap-3 border-b border-accent/30 bg-[linear-gradient(120deg,#08110e_0%,#10241d_52%,#173628_100%)] px-4 py-3 text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur md:z-10 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-5 md:py-4">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
          <div className="flex flex-col gap-1 md:min-w-[260px]">
            <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setMobileNavOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/35 bg-black/20 text-lg text-accent transition hover:border-accent hover:bg-black/35 md:hidden"
                aria-label="Навигация"
              >
                ☰
              </button>
            )}
            <p className="text-sm font-semibold text-white drop-shadow-[0_0_14px_rgba(62,219,138,0.25)]">
              {currentUnit || 'УИ-ТЭЦ'}
            </p>
          </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-white/75">
              {breadcrumbs.map((item, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <span key={`${item.to}-${item.label}`} className="inline-flex items-center gap-1">
                    {isLast ? (
                      <span className="rounded-full border border-accent/30 bg-black/25 px-2 py-0.5 font-semibold text-white">
                        {item.label}
                      </span>
                    ) : (
                      <NavLink to={item.to} className="rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-white/85 transition hover:border-accent/50 hover:text-white">
                        {item.label}
                      </NavLink>
                    )}
                    {!isLast && <span className="text-white/45">›</span>}
                  </span>
                )
              })}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 text-xs text-white/90 md:w-auto md:justify-end">
            <span className="rounded-full border border-accent/35 bg-black/20 px-3 py-1 text-white">
              {dateFormatter.format(now)} (UTC+8)
            </span>
            <WeatherWidget />
            {user ? (
              <div className="flex items-center gap-2 rounded-full border border-accent/35 bg-black/20 px-3 py-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">Вошли</span>
                <span className="text-xs text-white">{user.email}</span>
                <button
                  onClick={handleProfile}
                  className="rounded-full border border-accent/45 bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/25 hover:text-white"
                >
                  Профиль
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/30 bg-black/20 px-3 py-1 text-[11px] text-white transition hover:border-accent hover:text-accent"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-background"
              >
                Войти
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default Layout
