import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useProfile } from '../hooks/useProfile'

const fallbackFeed = [
  { id: 'f1', title: 'Обновление регламента ППР', body: 'Новая версия доступна в разделе документации.', type: 'docs' },
  { id: 'f2', title: 'Подготовка к смене', body: 'Проверьте закрепления по рабочим местам перед началом смены.', type: 'personnel' },
  { id: 'f3', title: 'Еженедельный обход', body: 'Сформирован план обхода на текущую неделю.', type: 'equipment' },
]

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .trim()

const inferUnitCode = (text) => {
  const value = normalize(text)
  if (value.includes('котлотурбин')) return 'ktc'
  if (value.includes('хим')) return 'chem'
  if (value.includes('электро')) return 'electro'
  if (value.includes('автомат')) return 'sai'
  if (value.includes('топлив')) return 'fuel'
  return 'ktc'
}

const getRoleMeta = (employee) => {
  const position = normalize(employee?.positions?.name || '')
  const positionType = normalize(employee?.positions?.type || '')
  const isChief = position.includes('начальник смены') || position.includes('нач смены')
  const isOperational = positionType.includes('оператив')
  const isAdministrative = positionType.includes('административ')
  if (isChief) {
    return {
      title: 'Начальник смены',
      description: 'Подтверждение состава смены, контроль исполнения и оперативные решения.',
      quickLinks: [
        { to: '/shift/today', label: 'Текущая смена' },
        { to: '/topics', label: 'Темы смены' },
        { to: '/rounds/today', label: 'Обход сегодня' },
      ],
    }
  }
  if (isOperational) {
    return {
      title: 'Оперативный персонал',
      description: 'Работа по посту, обходы, подтверждения и сменные задачи.',
      quickLinks: [
        { to: '/shift/today', label: 'Моя смена' },
        { to: '/rounds/today', label: 'Обход сегодня' },
        { to: '/rounds/history', label: 'История обходов' },
      ],
    }
  }
  if (isAdministrative) {
    return {
      title: 'Административно-технический персонал',
      description: 'Планирование, документы, контроль исполнения и аналитика.',
      quickLinks: [
        { to: '/topics', label: 'Темы и шаблоны' },
        { to: '/rounds/history', label: 'История обходов' },
      ],
    }
  }
  return {
    title: 'Сотрудник',
    description: 'Общая информация, уведомления и взаимодействие с командой.',
    quickLinks: [{ to: '/profile', label: 'Профиль' }],
  }
}

function SocialHubPage() {
  const supabase = useSupabase()
  const profile = useProfile()
  const [feed, setFeed] = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [feedError, setFeedError] = useState('')

  const employee = profile.employee
  const role = useMemo(() => getRoleMeta(employee), [employee])
  const preferredUnit = useMemo(() => inferUnitCode(profile.divisionText), [profile.divisionText])

  useEffect(() => {
    let active = true
    async function loadFeed() {
      setLoadingFeed(true)
      setFeedError('')
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, type, unit, created_at')
        .order('created_at', { ascending: false })
        .limit(12)
      if (!active) return
      if (error) {
        setFeedError(error.message || 'Не удалось загрузить ленту')
        setFeed(fallbackFeed)
      } else {
        const rows = (data || []).map((item) => ({
          id: item.id,
          title: item.title || 'Без заголовка',
          body: item.body || '',
          type: item.type || 'info',
          unit: item.unit || '—',
          createdAt: item.created_at || null,
        }))
        setFeed(rows.length ? rows : fallbackFeed)
      }
      setLoadingFeed(false)
    }
    void loadFeed()
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Соцсеть работников</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Личное рабочее пространство</h2>
        <p className="mt-2 text-sm text-slate-300">
          {profile.fio || 'Сотрудник'} · {role.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">{role.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Общая лента</h3>
            <Link
              to={`/${preferredUnit}/docs`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-100 transition hover:border-sky-400/60"
            >
              Документация
            </Link>
          </div>
          {loadingFeed && <p className="mt-3 text-xs text-slate-400">Загружаем ленту…</p>}
          {feedError && <p className="mt-3 text-xs text-rose-300">Лента: {feedError}</p>}
          <div className="mt-3 space-y-2">
            {feed.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.body || '—'}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {item.type} · {item.unit || 'общий'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Персональные действия</h3>
          <div className="mt-3 space-y-2">
            {role.quickLinks.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="block rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 transition hover:border-emerald-400/60"
              >
                {action.label}
              </Link>
            ))}
            <Link
              to={`/${preferredUnit}/personnel`}
              className="block rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 transition hover:border-emerald-400/60"
            >
              Календарь персонала
            </Link>
            <Link
              to="/profile"
              className="block rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 transition hover:border-emerald-400/60"
            >
              Мой профиль
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SocialHubPage
