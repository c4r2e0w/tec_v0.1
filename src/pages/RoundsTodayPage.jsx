import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
import { createShiftHandoverService } from '../services/shiftHandoverService'

const todayIso = () => new Date().toISOString().slice(0, 10)

function RoundsTodayPage() {
  const supabase = useSupabase()
  const workflow = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const handover = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const navigate = useNavigate()

  const [unit, setUnit] = useState('ktc')
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const topicRes = await handover.fetchTopicForDate({ unit, shiftDate: todayIso() })
      if (!topicRes.error) setTopic(topicRes.data || null)
    }
    void load()
  }, [handover, unit])

  const handleStart = async () => {
    setLoading(true)
    setError('')
    const res = await workflow.startRoundForToday({ unit })
    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }
    setLoading(false)
    navigate(`/rounds/${res.data}`)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-grayText">Rounds</p>
        <h1 className="text-xl font-semibold text-dark">Сегодня: обходы / проверки</h1>
      </div>

      <label className="text-xs text-grayText">Unit
        <input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark md:w-56" />
      </label>

      <div className="rounded-xl border border-border bg-background p-3 text-sm text-dark">
        <p className="text-xs uppercase tracking-[0.2em] text-grayText">Тема 5-минутки</p>
        <p className="mt-1">{topic?.topic || 'Тема не задана'}</p>
      </div>

      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      <button onClick={handleStart} disabled={loading} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? 'Создаем...' : 'Начать обход'}
      </button>
    </div>
  )
}

export default RoundsTodayPage
