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
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">Смена</p>
            <h1 className="text-xl font-semibold text-dark">Состав смены</h1>
          </div>
          <button className="rounded-full border border-border px-3 py-1 text-xs text-dark transition hover:border-accent/70 hover:text-dark">
            Добавить
          </button>
        </div>
        <p className="mt-2 text-sm text-grayText">Данные подгружаются из таблицы roster.</p>
        {error && <p className="text-sm text-orange-300">Ошибка: {error}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {roster.map((person) => (
          <div
            key={person.id || person.name}
            className="rounded-xl border border-border bg-background p-4 text-sm text-dark transition hover:border-emerald-400/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grayText">
              <span>{person.role || person.position || '—'}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                {person.status || 'На месте'}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-dark">{person.name || person.full_name || 'Без имени'}</p>
            <p className="text-xs text-grayText">{person.location || person.control_point || '—'}</p>
          </div>
        ))}
        {!loading && !error && roster.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-grayText">
            Нет записей в roster.
          </div>
        )}
      </div>
    </div>
  )
}

export default RosterPage
