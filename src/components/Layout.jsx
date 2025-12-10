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
  const location = useLocation()
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.key, u.title])), [])
  const currentUnit = useMemo(() => {
    const pathUnit = location.pathname.split('/').filter(Boolean)[0]
    return unitMap[pathUnit] || null
  }, [location.pathname, unitMap])
  const mainOffset = 'md:ml-64'

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

  const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Irkutsk',
  })

  const navContent = (
    <nav className="flex flex-col gap-5 text-sm text-slate-300">
      {user && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Подразделения</p>
          {units.map((unit) => {
            const expanded = openUnit === unit.key
            return (
              <div key={unit.key} className="rounded-xl border border-white/5 bg-white/5">
                <button
                  onClick={() => {
                    setOpenUnit(expanded ? null : unit.key)
                    navigate(`/${unit.key}`)
                    setMobileNavOpen(false)
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-slate-100 transition hover:border-sky-400/40 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center text-base">{unit.icon}</span>
                    <span>{unit.title}</span>
                  </span>
                  <span className="text-xs text-slate-400">{expanded ? '–' : '+'}</span>
                </button>
                {expanded && (
                  <div className="flex flex-col border-t border-white/5">
                    {['personnel', 'equipment', 'docs'].map((section) => (
                      <NavLink
                        key={section}
                        to={`/${unit.key}/${section}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          [
                            'px-4 py-2 text-sm transition',
                            isActive
                              ? 'bg-sky-500/15 text-white border-l-2 border-sky-400'
                              : 'hover:bg-white/5 hover:text-white',
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Аккаунт</p>
          <div className="flex flex-col gap-2">
            <NavLink
              to="/profile"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                [
                  'rounded-xl px-4 py-2 transition',
                  isActive
                    ? 'bg-sky-500/15 text-white border border-sky-400/60 shadow-sm shadow-sky-900/30'
                    : 'border border-white/5 hover:border-sky-400/40 hover:text-white',
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
                    ? 'bg-emerald-500/15 text-white border border-emerald-400/60 shadow-sm shadow-emerald-900/30'
                    : 'border border-white/5 hover:border-emerald-400/40 hover:text-white',
                ].join(' ')
              }
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">🏅</span>
                <span>Профсоюз</span>
              </span>
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  )

  return (
    <div className="relative flex min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-10 top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-white/5 bg-slate-900/80 px-6 py-8 shadow-lg shadow-sky-900/10 backdrop-blur md:flex">
        <div
          onClick={() => navigate('/')}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-1 transition hover:border-sky-500/40"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-lg font-semibold text-slate-950">
            УИ
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">УИ-ТЭЦ портал</p>
            <p className="text-sm font-semibold">Инфо · Соц · Работа</p>
          </div>
        </div>
        {navContent}
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex-col gap-6 border-r border-white/5 bg-slate-900/95 px-6 py-8 shadow-lg shadow-sky-900/20 backdrop-blur transition-transform duration-200 md:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between">
          <div
            onClick={() => {
              navigate('/')
              setMobileNavOpen(false)
            }}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-1 transition hover:border-sky-500/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-lg font-semibold text-slate-950">
              УИ
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">УИ-ТЭЦ портал</p>
              <p className="text-sm font-semibold">Инфо · Соц · Работа</p>
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Закрыть меню"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 transition hover:border-sky-400/60"
          >
            ✕
          </button>
        </div>
        {navContent}
      </aside>

      <div className={`relative z-10 flex flex-1 flex-col ${mainOffset}`}>
        <header className="sticky top-0 flex flex-col gap-3 border-b border-white/5 bg-slate-900/80 px-5 py-4 backdrop-blur md:z-10 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex items-center gap-2 md:min-w-[180px]">
            {user && (
              <button
                onClick={() => setMobileNavOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-white transition hover:border-sky-400/60 md:hidden"
                aria-label="Навигация"
              >
                ☰
              </button>
            )}
            <p className="text-sm font-semibold text-white">{currentUnit || 'УИ-ТЭЦ'}</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 text-xs text-slate-300 md:w-auto md:justify-end">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              {dateFormatter.format(now)} (UTC+8)
            </span>
            <WeatherWidget />
            {user ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Вошли</span>
                <span className="text-xs text-white">{user.email}</span>
                <button
                  onClick={handleProfile}
                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Профиль
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-100 transition hover:border-sky-400/70 hover:text-white"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Войти
              </button>
            )}
          </div>
        </header>

        {user && (
          <div className="px-5 pb-4 md:hidden">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-lg shadow-sky-900/10">
              {navContent}
            </div>
          </div>
        )}

        <main className="flex-1 px-5 py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default Layout
