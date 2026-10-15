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
      if (active) {
        setSession(nextSession)
        setAuthReady(true)
        if (!nextSession) {
          setEquipment([])
          setTypes([])
          setSystems([])
          setMemberships([])
          setWorkplaces([])
        }
      }
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-grayText">Оборудование · MyTEC</p>
        <h1 className="text-xl font-semibold text-dark">База оборудования{unit ? ` · ${unit.toUpperCase()}` : ''}</h1>
        <p className="mt-2 text-sm text-grayText">{loading ? 'Загрузка…' : `Записей: ${rows.length}`}</p>
        <p className="mt-2 text-xs text-grayText">Статусы оборудования в каталоге не подтверждают фактическую оперативную обстановку.</p>
        {error && <p role="alert" className="mt-2 text-sm text-rose-600">Ошибка: {error}</p>}
      </div>
      <div className="rounded-2xl border border-border bg-white p-4 shadow-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Код / тип</th><th className="p-2">Название</th><th className="p-2">№</th><th className="p-2">Система</th><th className="p-2">Рабочее место</th><th className="p-2">Статус</th></tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.id} className="border-t">
              <td className="p-2">{row.code}<div className="text-xs text-grayText">{typeById.get(row.equipment_type_id)?.name || '—'}</div></td>
              <td className="p-2">{row.name || '—'}</td>
              <td className="p-2">{row.station_number ?? '—'}</td>
              <td className="p-2">{systems.find(s => s.id === primarySystemByEquipment.get(row.id))?.name || 'Не назначена'}</td>
              <td className="p-2">{workplaceById.get(row.primary_workplace_id)?.name || '—'}</td>
              <td className="p-2">{STATUS_LABELS[row.status] || row.status || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
        {!loading && !error && rows.length === 0 && <p className="p-3 text-sm text-grayText">Нет доступных записей для выбранного фильтра. Проверьте рабочее место и права доступа.</p>}
      </div>
    </div>
  )
}

export default EquipmentPage
