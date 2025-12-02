import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createOrder, fetchOrders } from '../lib/orders'
import { useSupabase } from '../context/SupabaseProvider'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-orange-500/20 to-slate-900' },
  chem: { name: 'Химический цех', color: 'from-cyan-500/20 to-slate-900' },
  electro: { name: 'Электроцех', color: 'from-emerald-500/20 to-slate-900' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-sky-500/20 to-slate-900' },
  fuel: { name: 'Цех топливоподачи', color: 'from-amber-500/20 to-slate-900' },
}

const sections = {
  personnel: 'Персонал',
  equipment: 'Оборудование',
  docs: 'Документация',
}

function UnitSectionPage() {
  const { unit, section } = useParams()
  const unitData = units[unit]
  const sectionLabel = sections[section]
  const isKtc = unit === 'ktc'
  const supabase = useSupabase()
  const [orders, setOrders] = useState({ admin: [], turbine: [], boiler: [], daily: [] })
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [newEntry, setNewEntry] = useState({ type: 'admin', title: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState(['admin', 'turbine', 'boiler', 'daily'])

  const bg = unitData?.color || 'from-slate-800 to-slate-900'

  const subtitle = useMemo(() => {
    if (!unitData || !sectionLabel) return 'Раздел не найден'
    if (section === 'personnel') return 'Состав смены, контакты, роли'
    if (section === 'equipment') return 'Реестр оборудования, статус и ППР'
    if (section === 'docs') return 'Инструкции, регламенты, чек-листы'
    return ''
  }, [unitData, sectionLabel, section])

  const filteredList = useMemo(() => {
    const list = selectedTypes.flatMap((t) => orders[t] || [])
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [orders, selectedTypes])

  useEffect(() => {
    if (!isKtc || section !== 'docs') return
    async function loadOrders() {
      setLoadingOrders(true)
      setOrderError('')
      const types = ['admin', 'turbine', 'boiler', 'daily']
      const result = { admin: [], turbine: [], boiler: [], daily: [] }
      for (const t of types) {
        const { data, error } = await fetchOrders({ type: t })
        if (error) {
          setOrderError(error.message)
          break
        }
        result[t] = data || []
      }
      setOrders(result)
      setLoadingOrders(false)
    }
    loadOrders()
  }, [isKtc, section, supabase])

  const handleCreate = async () => {
    if (!newEntry.title.trim()) {
      setOrderError('Введите заголовок')
      return
    }
    setSaving(true)
    setOrderError('')
    const { error } = await createOrder({
      type: newEntry.type,
      title: newEntry.title,
      body: newEntry.body,
    })
    if (error) {
      setOrderError(error.message)
    } else {
      // reload lists
      const { data } = await fetchOrders({ type: newEntry.type })
      setOrders((prev) => ({ ...prev, [newEntry.type]: data || [] }))
      setNewEntry({ type: newEntry.type, title: '', body: '' })
    }
    setSaving(false)
  }

  if (!unitData || !sectionLabel) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Навигация</p>
        <p className="text-lg font-semibold text-white">Раздел не найден</p>
        <p className="text-xs text-slate-400">Выберите подразделение в меню слева.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${bg} p-8 shadow-xl shadow-sky-900/10`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
          {unitData.name} · {sectionLabel}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{sectionLabel}</h1>
        <p className="mt-2 text-sm text-slate-200">{subtitle}</p>
      </div>

      {isKtc && section === 'docs' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Журналы КТЦ</p>
            <h3 className="text-lg font-semibold text-white">Распоряжения и ведомости</h3>
            <p className="text-sm text-slate-300">
              Только для КТЦ. Другие подразделения пока не трогаем. {loadingOrders && 'Загрузка...'}
            </p>
            {orderError && <p className="text-xs text-orange-300">Ошибка: {orderError}</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Новая запись</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300">
                Тип
                <select
                  value={newEntry.type}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, type: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                >
                  <option value="admin">Административные (КТЦ)</option>
                  <option value="turbine">Тех. ТО</option>
                  <option value="boiler">Тех. КО</option>
                  <option value="daily">Суточная ведомость</option>
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Заголовок
                <input
                  value={newEntry.title}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, title: e.target.value }))}
                  type="text"
                  placeholder="Краткое распоряжение"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
              </label>
            </div>
              <label className="mt-2 block text-xs text-slate-300">
                Описание
                <textarea
                  value={newEntry.body}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, body: e.target.value }))}
                rows={3}
                placeholder="Детали распоряжения / действия"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Сохраняем...' : 'Создать'}
              </button>
              <button
                onClick={() => setNewEntry({ ...newEntry, title: '', body: '' })}
                disabled={saving}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Очистить
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-white">Распоряжения / ведомости</p>
              <span className="rounded-full border border-white/10 bg-sky-500/15 px-3 py-1 text-[11px] uppercase text-slate-100">
                {selectedTypes.join(', ') || 'нет источников'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { key: 'admin', label: 'Административные (КТЦ)' },
                { key: 'turbine', label: 'Тех. ТО' },
                { key: 'boiler', label: 'Тех. КО' },
                { key: 'daily', label: 'Суточная ведомость' },
              ].map((src) => (
                <button
                  key={src.key}
                  onClick={() => {
                    setSelectedTypes((prev) =>
                      prev.includes(src.key) ? prev.filter((t) => t !== src.key) : [...prev, src.key],
                    )
                  }}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selectedTypes.includes(src.key)
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-white/10 text-slate-100 hover:border-sky-400/60 hover:text-white'
                  }`}
                >
                  {src.label} ({orders[src.key]?.length || 0})
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {filteredList.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>#{item.id}</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString('ru-RU') : ''}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    Автор: {item.author_name || '—'} {item.control_point ? `· ${item.control_point}` : ''}
                    {item.type ? ` · ${item.type}` : ''}
                  </p>
                  <span className="inline-block rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] uppercase text-sky-100">
                    {item.type}
                  </span>
                  {item.body && <p className="text-xs text-slate-300">{item.body}</p>}
                </div>
              ))}
              {!filteredList.length && !loadingOrders && <p className="text-xs text-slate-400">Нет записей</p>}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200 shadow-lg">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Следующие шаги</p>
        <ul className="mt-3 space-y-2">
          {section === 'personnel' && (
            <>
              <li>• Подключить выборку состава смены по подразделению</li>
              <li>• Добавить контакты и роли (operator / supervisor)</li>
            </>
          )}
          {section === 'equipment' && (
            <>
              <li>• Фильтровать оборудование по подразделению</li>
              <li>• Показать статус ППР и ответственного</li>
            </>
          )}
          {section === 'docs' && (
            <>
              <li>• Вывести регламенты и инструкции для подразделения</li>
              <li>• Добавить быстрый поиск и фильтр по тегам</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

export default UnitSectionPage
