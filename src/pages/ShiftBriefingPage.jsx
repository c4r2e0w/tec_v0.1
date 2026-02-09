import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { createShiftWorkflowService } from '../services/shiftWorkflowService'
import { createShiftHandoverService } from '../services/shiftHandoverService'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

const todayIso = () => new Date().toISOString().slice(0, 10)

function ShiftBriefingPage() {
  const supabase = useSupabase()
  const workflow = useMemo(() => createShiftWorkflowService(supabase), [supabase])
  const handover = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const { user } = useAuth()
  const profile = useProfile()

  const [unit, setUnit] = useState('ktc')
  const [date, setDate] = useState(todayIso)
  const [shiftType, setShiftType] = useState('day')
  const [session, setSession] = useState(null)
  const [topic, setTopic] = useState(null)
  const [rows, setRows] = useState([])
  const [workplaces, setWorkplaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isChief = useMemo(() => {
    const position = String(profile?.employee?.positions?.name || '').toLowerCase()
    return position.includes('начальник смены')
  }, [profile?.employee?.positions?.name])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const [topicRes, wpRes] = await Promise.all([
      handover.fetchTopicForDate({ unit, shiftDate: date }),
      workflow.fetchWorkplaces({ unit }),
    ])
    if (!topicRes.error) setTopic(topicRes.data || null)
    if (!wpRes.error) setWorkplaces(wpRes.data || [])

    const sessionRes = await handover.fetchSession({ unit, shiftDate: date, shiftType })
    if (sessionRes.error) {
      setSession(null)
      setRows([])
      setLoading(false)
      return
    }
    setSession(sessionRes.data || null)
    if (sessionRes.data?.id) {
      const assignmentsRes = await handover.fetchAssignments({ sessionId: sessionRes.data.id })
      if (assignmentsRes.error) {
        setError(assignmentsRes.error.message)
      } else {
        setRows(assignmentsRes.data || [])
      }
    } else {
      setRows([])
    }
    setLoading(false)
  }, [date, handover, shiftType, unit, user, workflow])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    const res = await workflow.createOrGetBriefing({ date, unit, shiftType })
    if (res.error) {
      setError(res.error.message)
      setSaving(false)
      return
    }
    setSuccess('Черновик инструктажа готов')
    setSaving(false)
    await load()
  }

  const handleRowChange = (employeeId, patch) => {
    setRows((prev) => prev.map((row) => (row.employee_id === employeeId ? { ...row, ...patch } : row)))
  }

  const handleSaveRows = async () => {
    if (!session?.id) return
    setSaving(true)
    setError('')
    const payload = rows.map((row) => ({
      session_id: session.id,
      employee_id: row.employee_id,
      workplace_code: row.workplace_code || 'general',
      position_name: row.position_name || null,
      source: row.source || 'manual',
      is_present: Boolean(row.is_present),
      note: row.note || null,
      confirmed_by_chief: Boolean(row.confirmed_by_chief),
    }))
    const res = await handover.upsertAssignments(payload)
    if (res.error) {
      setError(res.error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setSuccess('Состав смены сохранен')
    await load()
  }

  const handleConfirm = async () => {
    if (!session?.id) return
    setSaving(true)
    setError('')
    const saveRes = await handover.upsertAssignments(
      rows.map((row) => ({
        session_id: session.id,
        employee_id: row.employee_id,
        workplace_code: row.workplace_code || 'general',
        position_name: row.position_name || null,
        source: row.source || 'manual',
        is_present: Boolean(row.is_present),
        note: row.note || null,
        confirmed_by_chief: Boolean(row.confirmed_by_chief),
      })),
    )
    if (saveRes.error) {
      setError(saveRes.error.message)
      setSaving(false)
      return
    }

    const res = await workflow.confirmBriefing({ briefingId: session.id })
    if (res.error) {
      setError(res.error.message)
      setSaving(false)
      return
    }
    setSuccess('Смена принята, персонал проинструктирован')
    setSaving(false)
    await load()
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-grayText">Shift</p>
        <h1 className="text-xl font-semibold text-dark">Предсменный инструктаж</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-grayText">Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark" />
        </label>
        <label className="text-xs text-grayText">Дата
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark" />
        </label>
        <label className="text-xs text-grayText">Тип смены
          <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark">
            <option value="day">День</option>
            <option value="night">Ночь</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button onClick={() => void load()} className="rounded-full border border-border px-4 py-2 text-sm text-dark">Обновить</button>
          <button onClick={handleCreate} disabled={!isChief || saving} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Создать/получить</button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-3 text-sm text-dark">
        <p className="text-xs uppercase tracking-[0.2em] text-grayText">Тема инструктажа</p>
        <p className="mt-1">{topic?.topic || 'Не задано'}</p>
      </div>

      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}
      {success && <p className="rounded-xl border border-eco/40 bg-eco-light px-3 py-2 text-sm text-dark">{success}</p>}

      {!isChief && <p className="text-xs text-grayText">Только начальник смены может подтверждать состав.</p>}

      {!!session && (
        <>
          <div className="rounded-xl border border-border bg-background p-3 text-xs text-grayText">
            Статус: <span className="text-dark">{session.status}</span> · ID: {session.id}
          </div>

          <div className="overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background text-grayText">
                <tr>
                  <th className="px-3 py-2 text-left">Сотрудник</th>
                  <th className="px-3 py-2 text-left">Рабочее место</th>
                  <th className="px-3 py-2 text-left">Присутствует</th>
                  <th className="px-3 py-2 text-left">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.employee_id} className="border-t border-border">
                    <td className="px-3 py-2 text-dark">
                      {row.employees
                        ? [row.employees.last_name, row.employees.first_name, row.employees.middle_name].filter(Boolean).join(' ')
                        : `ID ${row.employee_id}`}
                      <p className="text-xs text-grayText">{row.position_name || row.employees?.positions?.name || '—'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!isChief || session.status !== 'draft'}
                        value={row.workplace_code || ''}
                        onChange={(e) => handleRowChange(row.employee_id, { workplace_code: e.target.value })}
                        className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
                      >
                        <option value="">—</option>
                        {workplaces.map((wp) => (
                          <option key={wp.id} value={wp.code || wp.name}>{wp.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={!isChief || session.status !== 'draft'}
                        checked={Boolean(row.is_present)}
                        onChange={(e) => handleRowChange(row.employee_id, { is_present: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.note || ''}
                        disabled={!isChief || session.status !== 'draft'}
                        onChange={(e) => handleRowChange(row.employee_id, { note: e.target.value })}
                        className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="px-3 py-2 text-grayText" colSpan={4}>Нет состава смены. Нажмите «Создать/получить».</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button disabled={!isChief || saving || session.status !== 'draft'} onClick={handleSaveRows} className="rounded-full border border-border px-4 py-2 text-sm text-dark disabled:opacity-60">Сохранить черновик</button>
            <button disabled={!isChief || saving || session.status !== 'draft'} onClick={handleConfirm} className="rounded-full bg-eco px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Смена принята, персонал проинструктирован</button>
          </div>
        </>
      )}

      {loading && <p className="text-sm text-grayText">Загрузка...</p>}
    </div>
  )
}

export default ShiftBriefingPage
