import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'

function RosterPage() {
  const supabase = useSupabase()
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function fetchRoster() {
      setLoading(true)
      setError('')
      const { data, error: err } = await supabase.from('roster').select('*').limit(50)
      if (!active) return
      if (err) setError(err.message)
      else setRoster(data ?? [])
      setLoading(false)
    }
    fetchRoster()
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Смена</p>
            <h1 className="text-xl font-semibold text-white">Состав смены</h1>
          </div>
          <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white">
            Добавить
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-300">Данные подгружаются из таблицы roster.</p>
        {error && <p className="text-sm text-orange-300">Ошибка: {error}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {roster.map((person) => (
          <div
            key={person.id || person.name}
            className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200 transition hover:border-emerald-400/50"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{person.role || person.position || '—'}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                {person.status || 'На месте'}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{person.name || person.full_name || 'Без имени'}</p>
            <p className="text-xs text-slate-300">{person.location || person.control_point || '—'}</p>
          </div>
        ))}
        {!loading && !error && roster.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Нет записей в roster.
          </div>
        )}
      </div>
    </div>
  )
}

export default RosterPage
