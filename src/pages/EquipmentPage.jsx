import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'

function EquipmentPage() {
  const supabase = useSupabase()
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function fetchEquipment() {
      setLoading(true)
      setError('')
      const { data, error: err } = await supabase.from('equipment').select('*').limit(50)
      if (!active) return
      if (err) setError(err.message)
      else setEquipment(data ?? [])
      setLoading(false)
    }
    fetchEquipment()
    return () => {
      active = false
    }
  }, [supabase])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Оборудование</p>
            <h1 className="text-xl font-semibold text-white">Реестр оборудования</h1>
          </div>
          <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white">
            Фильтр
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          {loading ? 'Загрузка данных из Supabase…' : 'Данные подгружаются из таблицы equipment.'}
        </p>
        {error && <p className="text-sm text-orange-300">Ошибка: {error}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {equipment.map((eq) => (
          <div
            key={eq.id || `${eq.name}-${eq.area}`}
            className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200 transition hover:border-sky-400/50"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{eq.area || eq.zone || '—'}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                {eq.status || 'В работе'}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{eq.name || eq.id || eq.code || 'Без имени'}</p>
            <p className="text-xs text-slate-300">{eq.note || eq.description || '—'}</p>
          </div>
        ))}
        {!loading && !error && equipment.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Нет записей в equipment.
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentPage
