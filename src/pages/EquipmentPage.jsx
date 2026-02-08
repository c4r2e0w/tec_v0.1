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
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">Оборудование</p>
            <h1 className="text-xl font-semibold text-dark">Реестр оборудования</h1>
          </div>
          <button className="rounded-full border border-border px-3 py-1 text-xs text-dark transition hover:border-accent/70 hover:text-dark">
            Фильтр
          </button>
        </div>
        <p className="mt-2 text-sm text-grayText">
          {loading ? 'Загрузка данных из Supabase…' : 'Данные подгружаются из таблицы equipment.'}
        </p>
        {error && <p className="text-sm text-orange-300">Ошибка: {error}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {equipment.map((eq) => (
          <div
            key={eq.id || `${eq.name}-${eq.area}`}
            className="rounded-xl border border-border bg-background p-4 text-sm text-dark transition hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grayText">
              <span>{eq.area || eq.zone || '—'}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                {eq.status || 'В работе'}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-dark">{eq.name || eq.id || eq.code || 'Без имени'}</p>
            <p className="text-xs text-grayText">{eq.note || eq.description || '—'}</p>
          </div>
        ))}
        {!loading && !error && equipment.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-grayText">
            Нет записей в equipment.
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentPage
