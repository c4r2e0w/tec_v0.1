import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
import { useAuth } from '../hooks/useAuth'

function RoundRunPage() {
  const { id } = useParams()
  const supabase = useSupabase()
  const workflow = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const { user } = useAuth()

  const [run, setRun] = useState(null)
  const [checks, setChecks] = useState([])
  const [filesByCheck, setFilesByCheck] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    const runRes = await workflow.fetchRun({ runId: Number(id) })
    if (runRes.error) {
      setError(runRes.error.message)
      setLoading(false)
      return
    }
    setRun(runRes.data || null)

    const checksRes = await workflow.fetchRunChecks({ runId: Number(id) })
    if (checksRes.error) {
      setError(checksRes.error.message)
      setLoading(false)
      return
    }
    const list = checksRes.data || []
    setChecks(list)

    const filesRes = await workflow.fetchRunFiles({ checkIds: list.map((c) => c.id) })
    if (!filesRes.error) {
      const grouped = {}
      ;(filesRes.data || []).forEach((f) => {
        const key = String(f.check_id)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(f)
      })
      setFilesByCheck(grouped)
    }
    setLoading(false)
  }, [id, workflow])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const handleCheckChange = (checkId, patch) => {
    setChecks((prev) => prev.map((c) => (c.id === checkId ? { ...c, ...patch } : c)))
  }

  const saveDraft = async () => {
    setSaving(true)
    setError('')
    for (const check of checks) {
      const res = await workflow.updateCheck({
        checkId: check.id,
        payload: {
          status: check.status,
          comment: check.comment || null,
          measured_value: check.measured_value || null,
        },
      })
      if (res.error) {
        setError(res.error.message)
        setSaving(false)
        return
      }
    }
    await workflow.updateRun({ runId: Number(id), payload: { status: 'draft' } })
    setSaving(false)
    await load()
  }

  const submitRun = async () => {
    await saveDraft()
    setSaving(true)
    const res = await workflow.updateRun({
      runId: Number(id),
      payload: { status: 'submitted', submitted_at: new Date().toISOString() },
    })
    if (res.error) setError(res.error.message)
    setSaving(false)
    await load()
  }

  const uploadForCheck = async (checkId, file) => {
    if (!file || !run || !user) return
    setSaving(true)
    setError('')
    const path = `${run.id}/${checkId}/${Date.now()}_${file.name}`
    const up = await supabase.storage.from('round-files').upload(path, file)
    if (up.error) {
      setError(up.error.message)
      setSaving(false)
      return
    }
    const ins = await workflow.insertRunFile({
      payload: {
        check_id: checkId,
        storage_path: path,
        file_name: file.name,
        created_by_profile_id: user.id,
      },
    })
    if (ins.error) setError(ins.error.message)
    setSaving(false)
    await load()
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-grayText">Rounds</p>
        <h1 className="text-xl font-semibold text-dark">Выполнение обхода #{id}</h1>
      </div>
      {loading && <p className="text-sm text-grayText">Загрузка...</p>}
      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}
      {run && (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark">
          Дата: {run.run_date} · Unit: {run.unit || '—'} · Статус: {run.status}
        </p>
      )}

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.id} className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold text-dark">{check.inspection_items?.name || `Пункт ${check.item_id}`}</p>
            <p className="text-xs text-grayText">{check.inspection_items?.description || '—'}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <select
                value={check.status}
                onChange={(e) => handleCheckChange(check.id, { status: e.target.value })}
                className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
              >
                <option value="ok">OK</option>
                <option value="issue">ISSUE</option>
                <option value="na">NA</option>
              </select>
              <input
                value={check.measured_value || ''}
                onChange={(e) => handleCheckChange(check.id, { measured_value: e.target.value })}
                placeholder="Замер"
                className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
              />
              <input
                value={check.comment || ''}
                onChange={(e) => handleCheckChange(check.id, { comment: e.target.value })}
                placeholder="Комментарий"
                className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="file" onChange={(e) => void uploadForCheck(check.id, e.target.files?.[0])} className="text-xs" />
              {(filesByCheck[String(check.id)] || []).map((f) => (
                <span key={f.id} className="rounded-full border border-border bg-white px-2 py-0.5 text-xs text-dark">{f.file_name}</span>
              ))}
            </div>
          </div>
        ))}
        {!checks.length && !loading && <p className="text-sm text-grayText">Нет пунктов плана для этого обхода.</p>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => void saveDraft()} disabled={saving} className="rounded-full border border-border px-4 py-2 text-sm text-dark disabled:opacity-60">Сохранить черновик</button>
        <button onClick={() => void submitRun()} disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Отправить</button>
      </div>
    </div>
  )
}

export default RoundRunPage
