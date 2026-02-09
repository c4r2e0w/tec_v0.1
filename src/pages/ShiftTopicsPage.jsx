import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { createShiftHandoverService } from '../services/shiftHandoverService'

const toIsoLocalDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseIsoLocalDate = (dateStr) => {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map((value) => Number(value))
  return new Date(y, (m || 1) - 1, d || 1)
}

const monthStartOf = (dateStr) => {
  const d = parseIsoLocalDate(dateStr)
  d.setDate(1)
  return toIsoLocalDate(d)
}

const getRoundTopicFromMaterials = (materials) => {
  const raw = String(materials || '').trim()
  if (!raw) return ''
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return String(parsed?.round_topic || '')
    } catch {
      return ''
    }
  }
  return ''
}

const toMaterialsPayload = (roundTopic) => {
  const value = String(roundTopic || '').trim()
  if (!value) return null
  return JSON.stringify({ round_topic: value })
}

function ShiftTopicsPage() {
  const supabase = useSupabase()
  const handover = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const [params] = useSearchParams()

  const unit = params.get('unit') || 'ktc'
  const initialDate = params.get('date') || toIsoLocalDate(new Date())
  const [monthStart, setMonthStart] = useState(monthStartOf(initialDate))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const monthDates = useMemo(() => {
    const start = parseIsoLocalDate(monthStart)
    return Array.from({ length: 31 }, (_, idx) => {
      const d = new Date(start)
      d.setDate(start.getDate() + idx)
      return toIsoLocalDate(d)
    })
  }, [monthStart])

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError('')
        setMessage('')
        const from = monthDates[0]
        const to = monthDates[monthDates.length - 1]
        const res = await handover.fetchTopicsRange({ unit, from, to })
        if (res.error) {
          setError(res.error.message)
          setRows([])
          setLoading(false)
          return
        }
        const byDate = new Map((res.data || []).map((row) => [row.briefing_date, row]))
        const nextRows = monthDates.map((date) => {
          const item = byDate.get(date)
          return {
            date,
            topic: item?.topic || '',
            roundTopic: getRoundTopicFromMaterials(item?.materials),
            isMandatory: item?.is_mandatory ?? true,
          }
        })
        setRows(nextRows)
        setLoading(false)
      })()
    }, 0)
    return () => clearTimeout(timer)
  }, [handover, monthDates, unit])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    const payload = rows.map((row) => ({
      unit,
      month: monthStart,
      briefing_date: row.date,
      topic: String(row.topic || '').trim() || 'Тема не задана',
      materials: toMaterialsPayload(row.roundTopic),
      is_mandatory: Boolean(row.isMandatory),
    }))
    const res = await handover.upsertTopics(payload)
    if (res.error) {
      setError(res.error.message)
      setSaving(false)
      return
    }
    setMessage('Темы сохранены')
    setSaving(false)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-grayText">Темы смен</p>
          <h1 className="text-xl font-semibold text-dark">Пятиминутка и обход (31 день)</h1>
        </div>
        <Link to={`/${unit}/personnel`} className="rounded-full border border-border px-3 py-1 text-xs text-dark hover:border-accent/60">
          Назад к смене
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="text-grayText">
          Месяц
          <input
            type="month"
            value={monthStart.slice(0, 7)}
            onChange={(e) => setMonthStart(`${e.target.value}-01`)}
            className="ml-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-dark"
          />
        </label>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-grayText">Unit: {unit}</span>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? 'Сохраняем...' : 'Сохранить темы'}
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}
      {message && <p className="rounded-xl border border-eco/40 bg-eco-light px-3 py-2 text-sm text-dark">{message}</p>}

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-background text-grayText">
            <tr>
              <th className="px-3 py-2 text-left">Дата</th>
              <th className="px-3 py-2 text-left">Тема пятиминутки</th>
              <th className="px-3 py-2 text-left">Тема обхода</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.date} className="border-t border-border">
                <td className="px-3 py-2 text-dark">{idx + 1}. {new Date(row.date).toLocaleDateString('ru-RU')}</td>
                <td className="px-3 py-2">
                  <input
                    value={row.topic}
                    onChange={(e) => {
                      const value = e.target.value
                      setRows((prev) => prev.map((r) => (r.date === row.date ? { ...r, topic: value } : r)))
                    }}
                    className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.roundTopic}
                    onChange={(e) => {
                      const value = e.target.value
                      setRows((prev) => prev.map((r) => (r.date === row.date ? { ...r, roundTopic: value } : r)))
                    }}
                    className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm text-dark"
                  />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-3 py-2 text-grayText" colSpan={3}>Нет данных</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-sm text-grayText">Загрузка...</p>}
    </div>
  )
}

export default ShiftTopicsPage
