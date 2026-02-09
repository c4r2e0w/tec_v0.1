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

const TOPIC_TEMPLATE_DATES = Array.from({ length: 31 }, (_, idx) => `2000-01-${String(idx + 1).padStart(2, '0')}`)
const getMonthRange = (dateStr) => {
  const [y, m] = String(dateStr || '').split('-').map(Number)
  const start = new Date(y || new Date().getFullYear(), (m || 1) - 1, 1)
  const end = new Date(y || new Date().getFullYear(), (m || 1), 0)
  return { from: toIsoLocalDate(start), to: toIsoLocalDate(end) }
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

function ShiftTopicsPage() {
  const supabase = useSupabase()
  const handover = useMemo(() => createShiftHandoverService(supabase), [supabase])
  const [params] = useSearchParams()

  const unit = params.get('unit') || 'ktc'
  const initialDate = params.get('date') || toIsoLocalDate(new Date())
  const [rows, setRows] = useState([])
  const [baselineRows, setBaselineRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedDay = useMemo(() => Number(String(initialDate).slice(8, 10)) || 1, [initialDate])
  const currentMonthRange = useMemo(() => getMonthRange(initialDate), [initialDate])
  const isDirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(baselineRows), [rows, baselineRows])

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError('')
        setMessage('')
        const [templateRes, monthRes] = await Promise.all([
          handover.fetchTopicsRange({
            unit,
            from: TOPIC_TEMPLATE_DATES[0],
            to: TOPIC_TEMPLATE_DATES[TOPIC_TEMPLATE_DATES.length - 1],
          }),
          handover.fetchTopicsRange({ unit, from: currentMonthRange.from, to: currentMonthRange.to }),
        ])
        if (templateRes.error && monthRes.error) {
          setError(templateRes.error?.message || monthRes.error?.message || 'Не удалось загрузить темы')
          setRows([])
          setBaselineRows([])
          setLoading(false)
          return
        }
        const byTemplateDate = new Map((templateRes.data || []).map((row) => [row.briefing_date, row]))
        const byDayOfMonth = new Map()
        ;(monthRes.data || []).forEach((row) => {
          const day = Number(String(row.briefing_date || '').slice(8, 10))
          if (!day || byDayOfMonth.has(day)) return
          byDayOfMonth.set(day, row)
        })
        const nextRows = TOPIC_TEMPLATE_DATES.map((date) => {
          const day = Number(String(date).slice(8, 10))
          const item = byTemplateDate.get(date) || byDayOfMonth.get(day) || null
          return {
            date,
            topic: item?.topic || '',
            roundTopic: String(item?.round_topic || getRoundTopicFromMaterials(item?.materials) || ''),
            isMandatory: item?.is_mandatory ?? true,
          }
        })
        setRows(nextRows)
        setBaselineRows(nextRows)
        setLoading(false)
      })()
    }, 0)
    return () => clearTimeout(timer)
  }, [currentMonthRange.from, currentMonthRange.to, handover, unit])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    const payload = rows.map((row) => ({
      unit,
      month: '2000-01-01',
      briefing_date: row.date,
      topic: String(row.topic || '').trim() || 'Тема не задана',
      round_topic: String(row.roundTopic || '').trim() || null,
      is_mandatory: Boolean(row.isMandatory),
    }))
    const res = await handover.upsertTopics(payload)
    if (res.error) {
      setError(res.error.message)
      setSaving(false)
      return
    }
    setBaselineRows(rows)
    setMessage('Темы сохранены')
    setSaving(false)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-grayText">Темы смен</p>
          <h1 className="text-xl font-semibold text-dark">Шаблон тем (31 день)</h1>
        </div>
        <Link to={`/${unit}/personnel`} className="rounded-full border border-border px-3 py-1 text-xs text-dark hover:border-accent/60">
          Назад к смене
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-3 py-1 text-xs text-grayText">Unit: {unit}</span>
        <button
          onClick={handleSave}
          disabled={saving || loading || !isDirty}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? 'Сохраняем...' : isDirty ? 'Сохранить изменения' : 'Изменения сохранены'}
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
                <td className="px-3 py-2 text-dark">
                  {idx + 1}
                  {idx + 1 === selectedDay ? ' (сегодня)' : ''}
                </td>
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
