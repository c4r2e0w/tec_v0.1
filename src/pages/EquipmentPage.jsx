import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'

// The live MyTEC schema uses UUIDs and equipment_systems as a membership table.
// Do not query legacy system_types/subsystem_types/workplace tables.
const STATUS_LABELS = {
  in_operation: 'Работа',
  reserve: 'Резерв',
  repair: 'Ремонт',
  disabled: 'Отключено',
  decommissioned: 'Выведено из эксплуатации',
}
const STATUSES = Object.keys(STATUS_LABELS)
const newEquipment = () => ({
  equipment_type_id: '',
  code: '',
  name: '',
  station_number: '',
  status: 'reserve',
  system_id: '',
  primary_workplace_id: '',
})
const numberOrNull = (value) => {
  if (String(value).trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : NaN
}

function EquipmentPage() {
  const { unit } = useParams()
  const supabase = useSupabase()
  const [equipment, setEquipment] = useState([])
  const [types, setTypes] = useState([])
  const [systems, setSystems] = useState([])
  const [memberships, setMemberships] = useState([])
  const [workplaces, setWorkplaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [newRow, setNewRow] = useState(newEquipment)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    const requests = await Promise.all([
      supabase.from('equipment').select('id,code,name,model,station_number,status,equipment_type_id,primary_workplace_id').order('code').limit(5000),
      supabase.from('equipment_types').select('id,parent_id,code,name').limit(2000),
      supabase.from('technology_systems').select('id,code,name').limit(2000),
      supabase.from('equipment_systems').select('equipment_id,system_id,role,is_primary').limit(10000),
      supabase.from('workplaces').select('id,department_id,code,name').limit(1000),
    ])
    const failed = requests.map((result, i) => result.error ? `${['equipment','equipment_types','technology_systems','equipment_systems','workplaces'][i]}: ${result.error.message}` : null).filter(Boolean)
    if (failed.length) {
      setError(failed.join(' · '))
      setLoading(false)
      return
    }
    setEquipment(requests[0].data || [])
    setTypes(requests[1].data || [])
    setSystems(requests[2].data || [])
    setMemberships(requests[3].data || [])
    setWorkplaces(requests[4].data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (active) {
        setSession(data?.session || null)
        setAuthReady(true)
        if (sessionError) setAuthMessage(sessionError.message)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) { setSession(nextSession); setAuthReady(true) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [supabase])

  useEffect(() => { if (session?.user?.id) void reload() }, [reload, session?.user?.id])

  const typeById = useMemo(() => new Map(types.map(t => [t.id, t])), [types])
  const workplaceById = useMemo(() => new Map(workplaces.map(w => [w.id, w])), [workplaces])
  const primarySystemByEquipment = useMemo(() => {
    const map = new Map()
    for (const link of memberships) {
      if (!map.has(link.equipment_id) || link.is_primary) map.set(link.equipment_id, link.system_id)
    }
    return map
  }, [memberships])
  const rows = useMemo(() => equipment.filter(row => {
    if (!unit) return true
    // Do not guess a workshop from the equipment code or free-text fields.
    const workplace = workplaceById.get(row.primary_workplace_id)
    return [workplace?.code, workplace?.name].some(v => String(v || '').toLowerCase().includes(unit.toLowerCase()))
  }), [equipment, unit, workplaceById])

  const draftFor = row => drafts[row.id] || {
    name: row.name || '',
    station_number: row.station_number == null ? '' : String(row.station_number),
    status: row.status || 'reserve',
    primary_workplace_id: row.primary_workplace_id || '',
    system_id: primarySystemByEquipment.get(row.id) || '',
  }
  const edit = (row, field, value) => setDrafts(prev => ({
    ...prev, [row.id]: { ...draftFor(row), [field]: value },
  }))

  const save = async row => {
    const draft = draftFor(row)
    const stationNumber = numberOrNull(draft.station_number)
    if (Number.isNaN(stationNumber)) { setError('Станционный номер должен быть целым неотрицательным числом.'); return }
    const previous = primarySystemByEquipment.get(row.id) || ''
    if (previous && !draft.system_id) {
      setError('Нельзя снять привязку к системе из каталога: требуется сверка схемы.')
      return
    }
    if (!draft.name.trim()) {
      setError('Название оборудования не может быть пустым.')
      return
    }
    setSavingId(row.id)
    setError('')
    const { error: updateError } = await supabase.from('equipment').update({
      name: draft.name.trim(),
      station_number: stationNumber,
      status: draft.status,
      primary_workplace_id: draft.primary_workplace_id || null,
    }).eq('id', row.id)
    if (updateError) { setError(updateError.message); setSavingId(null); return }
    // Memberships are a separate UUID join table. Never write equipment.system_id.
    if (draft.system_id !== previous) {
      const oldPrimary = memberships.find(link => link.equipment_id === row.id && link.is_primary)
      if (oldPrimary && draft.system_id) {
        const { error: linkError } = await supabase.from('equipment_systems')
          .update({ system_id: draft.system_id })
          .eq('equipment_id', row.id)
          .eq('system_id', oldPrimary.system_id)
          .eq('role', oldPrimary.role)
        if (linkError) {
          setError('Оборудование сохранено, но связь не обновлена: ' + linkError.message)
          setSavingId(null)
          return
        }
      } else if (!oldPrimary && draft.system_id) {
        const { error: linkError } = await supabase.from('equipment_systems').insert({
          equipment_id: row.id, system_id: draft.system_id, role: 'primary', is_primary: true,
        })
        if (linkError) {
          setError('Оборудование сохранено, но связь не создана: ' + linkError.message)
          setSavingId(null)
          return
        }
      } else if (oldPrimary && !draft.system_id) {
        setError('Удаление привязки к системе требует отдельной проверки технологической схемы.')
        setSavingId(null)
        return
      }
    }
    setSavingId(null)
    setDrafts(prev => { const next = { ...prev }; delete next[row.id]; return next })
    await reload()
  }

  const add = async () => {
    const stationNumber = numberOrNull(newRow.station_number)
    if (!newRow.equipment_type_id || !newRow.code.trim() || !newRow.name.trim() || Number.isNaN(stationNumber)) {
      setError('Укажите тип, код, название и корректный станционный номер.')
      return
    }
    setAdding(true)
    setError('')
    const { data, error: insertError } = await supabase.from('equipment').insert({
      equipment_type_id: newRow.equipment_type_id,
      code: newRow.code.trim(),
      name: newRow.name.trim(),
      station_number: stationNumber,
      status: newRow.status,
      primary_workplace_id: newRow.primary_workplace_id || null,
    }).select('id').single()
    if (insertError) { setError(insertError.message); setAdding(false); return }
    let membershipError = ''
    if (newRow.system_id) {
      const { error: linkError } = await supabase.from('equipment_systems').insert({
        equipment_id: data.id, system_id: newRow.system_id, role: 'primary', is_primary: true,
      })
      if (linkError) membershipError = 'Оборудование создано, но связь с системой не создана: ' + linkError.message
    }
    setNewRow(newEquipment())
    setAdding(false)
    await reload()
    if (membershipError) setError(membershipError)
  }

  const requestLogin = async () => {
    setAuthMessage('')
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setAuthMessage(authError ? authError.message : 'Проверьте почту для входа.')
  }

  if (!authReady) return <p className="p-6 text-sm text-grayText">Проверка авторизации…</p>

  if (!session) {
    return <div className="rounded-2xl border border-border bg-white p-6 shadow-lg space-y-3">
      <h1 className="text-xl font-semibold">Каталог MyTEC · вход</h1>
      <p className="text-sm text-grayText">Каталог доступен только авторизованным пользователям.</p>
      <input type="email" aria-label="Электронная почта" placeholder="Электронная почта" value={email}
        onChange={e => setEmail(e.target.value)} className="w-full max-w-sm rounded border p-2" />
      <button onClick={() => void requestLogin()} disabled={!email.includes('@')}
        className="rounded-full bg-primary px-4 py-2 text-white disabled:opacity-60">Получить ссылку для входа</button>
      {authMessage && <p role="status" className="text-sm">{authMessage}</p>}
    </div>
  }

  const systemOptions = systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
  const workplaceOptions = workplaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
  const statusOptions = STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-grayText">Оборудование · MyTEC</p>
        <h1 className="text-xl font-semibold text-dark">База оборудования{unit ? ` · ${unit.toUpperCase()}` : ''}</h1>
        <p className="mt-2 text-sm text-grayText">{loading ? 'Загрузка…' : `Записей: ${rows.length}`}</p>
        <p className="mt-2 text-xs text-grayText">Статусы оборудования в каталоге не подтверждают фактическую оперативную обстановку.</p>
        {error && <p role="alert" className="mt-2 text-sm text-rose-600">Ошибка: {error}</p>}
      </div>
      <div className="rounded-2xl border border-border bg-white p-4 shadow-lg space-y-3">
        <p className="text-sm text-grayText">Редактирование пока закрыто: отдельные права записи ещё не настроены.</p>
        <h2 className="text-sm font-semibold">Добавить оборудование</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <select aria-label="Тип оборудования" value={newRow.equipment_type_id} onChange={e => setNewRow(p => ({...p,equipment_type_id:e.target.value}))} className="rounded border p-2">
            <option value="">Тип оборудования</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input aria-label="Код оборудования" placeholder="Код" value={newRow.code} onChange={e => setNewRow(p => ({...p,code:e.target.value}))} className="rounded border p-2" />
          <input aria-label="Название оборудования" placeholder="Название" value={newRow.name} onChange={e => setNewRow(p => ({...p,name:e.target.value}))} className="rounded border p-2" />
          <input aria-label="Станционный номер" placeholder="Станционный номер" value={newRow.station_number} onChange={e => setNewRow(p => ({...p,station_number:e.target.value}))} className="rounded border p-2" />
          <select aria-label="Технологическая система" value={newRow.system_id} onChange={e => setNewRow(p => ({...p,system_id:e.target.value}))} className="rounded border p-2"><option value="">Без системы</option>{systemOptions}</select>
          <select aria-label="Рабочее место" value={newRow.primary_workplace_id} onChange={e => setNewRow(p => ({...p,primary_workplace_id:e.target.value}))} className="rounded border p-2"><option value="">Без рабочего места</option>{workplaceOptions}</select>
          <select aria-label="Статус" value={newRow.status} onChange={e => setNewRow(p => ({...p,status:e.target.value}))} className="rounded border p-2">{statusOptions}</select>
        </div>
        <button disabled={true} onClick={() => void add()} className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-60">{adding ? 'Добавление…' : 'Добавить'}</button>
      </div>
      <div className="rounded-2xl border border-border bg-white p-4 shadow-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Код / тип</th><th className="p-2">Название</th><th className="p-2">№</th><th className="p-2">Система</th><th className="p-2">Рабочее место</th><th className="p-2">Статус</th><th className="p-2">Действие</th></tr></thead>
          <tbody>{rows.map(row => {
            const d = draftFor(row)
            return <tr key={row.id} className="border-t">
              <td className="p-2">{row.code}<div className="text-xs text-grayText">{typeById.get(row.equipment_type_id)?.name || '—'}</div></td>
              <td className="p-2"><input aria-label={`Название ${row.code}`} value={d.name} onChange={e => edit(row,'name',e.target.value)} className="w-36 rounded border p-1" /></td>
              <td className="p-2"><input aria-label={`Номер ${row.code}`} value={d.station_number} onChange={e => edit(row,'station_number',e.target.value)} className="w-16 rounded border p-1" /></td>
              <td className="p-2"><select aria-label={`Система ${row.code}`} value={d.system_id} onChange={e => edit(row,'system_id',e.target.value)} className="w-40 rounded border p-1"><option value="">—</option>{systemOptions}</select></td>
              <td className="p-2"><select aria-label={`Рабочее место ${row.code}`} value={d.primary_workplace_id} onChange={e => edit(row,'primary_workplace_id',e.target.value)} className="w-40 rounded border p-1"><option value="">—</option>{workplaceOptions}</select></td>
              <td className="p-2"><select aria-label={`Статус ${row.code}`} value={d.status} onChange={e => edit(row,'status',e.target.value)} className="rounded border p-1">{statusOptions}</select></td>
              <td className="p-2"><button disabled={true} onClick={() => void save(row)} className="rounded-full border px-3 py-1 disabled:opacity-60">{savingId === row.id ? '…' : 'Сохранить'}</button></td>
            </tr>
          })}</tbody>
        </table>
        {!loading && rows.length === 0 && <p className="p-3 text-sm text-grayText">Нет оборудования для выбранного фильтра или отсутствует доступ по RLS.</p>}
      </div>
    </div>
  )
}

export default EquipmentPage
