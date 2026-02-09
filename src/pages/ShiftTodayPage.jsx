import { useEffect, useMemo, useState } from 'react'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
import { useSupabase } from '../context/SupabaseProvider'

function ShiftTodayPage() {
  const supabase = useSupabase()
  const workflow = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const [unit, setUnit] = useState('ktc')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const res = await workflow.getMyShiftToday({ unit })
      if (res.error) setError(res.error.message)
      else setData(Array.isArray(res.data) ? res.data[0] || null : res.data || null)
      setLoading(false)
    }
    void load()
  }, [unit, workflow])

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-grayText">Shift</p>
        <h1 className="text-xl font-semibold text-dark">Моя смена</h1>
      </div>
      <label className="text-xs text-grayText">Unit
        <input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark md:w-56" />
      </label>

      {loading && <p className="text-sm text-grayText">Загрузка...</p>}
      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      {!loading && !error && !data && (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark">Вы не в составе смены на сегодня.</p>
      )}

      {data && (
        <div className="grid gap-2 rounded-xl border border-border bg-background p-4 text-sm text-dark">
          <p>Дата: <b>{data.shift_date}</b></p>
          <p>Смена: <b>{data.shift_type === 'night' ? 'Ночь' : 'День'}</b></p>
          <p>Unit: <b>{data.unit || '—'}</b></p>
          <p>Рабочее место: <b>{data.workplace_code || '—'}</b></p>
          <p>Статус инструктажа: <b>{data.instructed ? 'проинструктирован' : 'не проинструктирован'}</b></p>
          <p>Присутствие: <b>{data.is_present ? 'в составе смены' : 'не в составе смены'}</b></p>
        </div>
      )}
    </div>
  )
}

export default ShiftTodayPage
