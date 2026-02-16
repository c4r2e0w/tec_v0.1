import { useEffect, useMemo, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'

function EquipmentPage() {
  const supabase = useSupabase()
  const [equipment, setEquipment] = useState([])
  const [subsystems, setSubsystems] = useState([])
  const [query, setQuery] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function fetchEquipment() {
      setLoading(true)
      setError('')
      const equipmentRes = await supabase.from('equipment').select('*').order('id', { ascending: true }).limit(3000)
      const equipmentFallback =
        equipmentRes.error &&
        (await supabase
          .from('equipment')
          .select('*')
          .order('id', { ascending: true })
          .limit(3000))
      const subsystemsRes = await supabase.from('equipment_subsystem_catalog').select('id, name').limit(3000)
      const subsystemsFallback =
        subsystemsRes.error &&
        (await supabase.from('equipment_subsystems').select('id, name').limit(3000))
      if (!active) return
      if (equipmentRes.error && equipmentFallback?.error) setError(equipmentRes.error.message)
      else setEquipment((equipmentRes.data ?? equipmentFallback?.data) || [])
      setSubsystems((subsystemsRes.data ?? subsystemsFallback?.data) || [])
      setLoading(false)
    }
    fetchEquipment()
    return () => {
      active = false
    }
  }, [supabase])

  const subsystemById = useMemo(
    () => new Map((subsystems || []).map((item) => [String(item.id), item])),
    [subsystems],
  )

  const systems = useMemo(() => {
    const values = new Set()
    for (const item of equipment) {
      if (item?.equipment_system) values.add(item.equipment_system)
    }
    return [...values].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [equipment])

  const types = useMemo(() => {
    const values = new Set()
    for (const item of equipment) {
      const typeName = item?.equipment_types?.name
      if (typeName) values.add(typeName)
    }
    return [...values].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [equipment])

  const statuses = useMemo(() => {
    const values = new Set()
    for (const item of equipment) {
      if (item?.status) values.add(item.status)
    }
    return [...values].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [equipment])

  const filteredEquipment = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    return equipment.filter((item) => {
      if (systemFilter !== 'all' && (item?.equipment_system || '') !== systemFilter) return false
      if (typeFilter !== 'all' && (item?.equipment_types?.name || '') !== typeFilter) return false
      if (statusFilter !== 'all' && (item?.status || '') !== statusFilter) return false
      const subsystemName =
        subsystemById.get(String(item?.subsystem_type_id || ''))?.name ||
        subsystemById.get(String(item?.subsystem_catalog_id || ''))?.name ||
        subsystemById.get(String(item?.subsystem_id || ''))?.name ||
        ''
      const stationNumber = String(item?.station_number || item?.name || '').trim()
      if (!q) return true
      const haystack = [stationNumber, subsystemName, item?.equipment_system, item?.equipment_types?.name, item?.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [equipment, query, statusFilter, subsystemById, systemFilter, typeFilter])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-grayText">Оборудование</p>
            <h1 className="text-xl font-semibold text-dark">Реестр оборудования</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-grayText">
          {loading
            ? 'Загрузка данных из Supabase…'
            : `Записей в реестре: ${equipment.length}. После фильтрации: ${filteredEquipment.length}.`}
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark placeholder:text-grayText"
          />
          <select
            value={systemFilter}
            onChange={(event) => setSystemFilter(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark"
          >
            <option value="all">Все системы</option>
            {systems.map((system) => (
              <option key={system} value={system}>
                {system}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark"
          >
            <option value="all">Все типы</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark"
          >
            <option value="all">Все статусы</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-orange-300">Ошибка: {error}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {filteredEquipment.map((eq) => (
          <div
            key={eq.id || `${eq.station_number || eq.name}-${eq.equipment_system}`}
            className="rounded-xl border border-border bg-background p-4 text-sm text-dark transition hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grayText">
              <span>{eq.equipment_system || 'Без системы'}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                {eq.status || 'В работе'}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-dark">
              {(subsystemById.get(String(eq?.subsystem_catalog_id || ''))?.name ||
                subsystemById.get(String(eq?.subsystem_type_id || ''))?.name ||
                subsystemById.get(String(eq?.subsystem_id || ''))?.name ||
                'Подсистема') +
                ' ' +
                String(eq?.station_number || eq?.name || eq.id || '').trim()}
            </p>
            <p className="text-xs text-grayText">{eq?.equipment_types?.name || eq?.type_id || 'Тип не указан'}</p>
          </div>
        ))}
        {!loading && !error && filteredEquipment.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-grayText">
            По текущим фильтрам записей нет.
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentPage
