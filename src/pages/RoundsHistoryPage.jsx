import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'

function RoundsHistoryPage() {
  const supabase = useSupabase()
  const workflow = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const res = await workflow.fetchMyRuns({ status })
      if (res.error) setError(res.error.message)
      else setRows(res.data || [])
      setLoading(false)
    }
    void load()
  }, [status, workflow])

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-grayText">Rounds</p>
        <h1 className="text-xl font-semibold text-dark">История обходов</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-grayText">Статус:</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark">
          <option value="">Все</option>
          <option value="draft">draft</option>
          <option value="submitted">submitted</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </div>

      {loading && <p className="text-sm text-grayText">Загрузка...</p>}
      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      <div className="space-y-2">
        {rows.map((row) => {
          const checks = row.round_run_checks || []
          const issues = checks.filter((c) => c.status === 'issue').length
          return (
            <div key={row.id} className="rounded-xl border border-border bg-background p-3 text-sm text-dark">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>#{row.id} · {row.run_date} · {row.unit || '—'}</p>
                <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs">{row.status}</span>
              </div>
              <p className="text-xs text-grayText">Замечаний: {issues}</p>
              <Link to={`/rounds/${row.id}`} className="text-xs text-accent underline">Открыть</Link>
            </div>
          )
        })}
        {!rows.length && !loading && <p className="text-sm text-grayText">Записей нет.</p>}
      </div>
    </div>
  )
}

export default RoundsHistoryPage
