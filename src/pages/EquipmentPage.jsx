import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'

const normalize = (value) => String(value || '').trim().toLowerCase()

const defaultStatuses = ['работа', 'резерв', 'ремонт']
const CONTROL_POINTS = [
  { value: 'нс_ктц', label: 'НС КТЦ' },
  { value: 'ст_машинист_по_ко', label: 'Ст. машинист по КО' },
  { value: 'цтщупк_1', label: 'ЦТЩУпк 1' },
  { value: 'цтщупк_2', label: 'ЦТЩУпк 2' },
  { value: 'цтщупк_3', label: 'ЦТЩУпк 3' },
  { value: 'машинист_обходчик_6р_по_ко', label: 'Машинист-обходчик 6р по КО' },
  { value: 'машинист_обходчик_5р_по_ко', label: 'Машинист-обходчик 5р по КО' },
  { value: 'машинист_обходчик_4р_по_ко', label: 'Машинист-обходчик 4р по КО' },
  { value: 'ст_машинист_по_то', label: 'Ст. машинист по ТО' },
  { value: 'цтщупт_1', label: 'ЦТЩУпт 1' },
  { value: 'цтщупт_2', label: 'ЦТЩУпт 2' },
  { value: 'цтщупт_3', label: 'ЦТЩУпт 3' },
  { value: 'цтщупт_4', label: 'ЦТЩУпт 4' },
  { value: 'машинист_обходчик_5р_по_то', label: 'Машинист-обходчик 5р по ТО' },
  { value: 'машинист_обходчик_4р_по_то', label: 'Машинист-обходчик 4р по ТО' },
]

function EquipmentPage() {
  const { unit } = useParams()
  const supabase = useSupabase()

  const [equipment, setEquipment] = useState([])
  const [systemTypes, setSystemTypes] = useState([])
  const [systems, setSystems] = useState([])
  const [subsystemTypes, setSubsystemTypes] = useState([])
  const [legacySubsystems, setLegacySubsystems] = useState([])
  const [workplaces, setWorkplaces] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [adding, setAdding] = useState(false)

  const [expandedTypes, setExpandedTypes] = useState(() => new Set(['all']))
  const [expandedSystems, setExpandedSystems] = useState(() => new Set())
  const [expandedSubsystems, setExpandedSubsystems] = useState(() => new Set())

  const [drafts, setDrafts] = useState({})
  const [newRow, setNewRow] = useState({
    system_id: '',
    subsystem_type_id: '',
    station_number: '',
    control_point: '',
    status: 'работа',
  })

  const equipmentColumns = useMemo(() => {
    const keys = new Set()
    for (const row of equipment) {
      Object.keys(row || {}).forEach((k) => keys.add(k))
    }
    return keys
  }, [equipment])

  const hasColumn = (name) => equipmentColumns.has(name)

  const systemTypeById = useMemo(
    () => new Map((systemTypes || []).map((row) => [String(row.id), row.name])),
    [systemTypes],
  )

  const systemById = useMemo(
    () => new Map((systems || []).map((row) => [String(row.id), row])),
    [systems],
  )
  const subsystemById = useMemo(() => {
    const map = new Map()
    for (const row of subsystemTypes || []) {
      map.set(String(row.id), {
        name: row.code || row.name || `ID ${row.id}`,
        fullName: row.full_name || row.description || '',
      })
    }
    for (const row of legacySubsystems || []) {
      if (!map.has(String(row.id))) {
        map.set(String(row.id), {
          name: row.name || `ID ${row.id}`,
          fullName: row.description || '',
        })
      }
    }
    return map
  }, [subsystemTypes, legacySubsystems])

  const controlPointOptions = useMemo(() => {
    const values = new Map(CONTROL_POINTS.map((row) => [row.value, row.label]))
    for (const row of workplaces || []) {
      if (row?.code) values.set(String(row.code), String(row.name || row.code))
    }
    for (const row of equipment || []) {
      if (row?.control_point) values.set(String(row.control_point), String(row.control_point))
    }
    return [...values.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [workplaces, equipment])

  const statuses = useMemo(() => {
    const values = new Set(defaultStatuses)
    for (const row of equipment || []) {
      if (row?.status) values.add(String(row.status).toLowerCase())
    }
    return [...values]
  }, [equipment])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const [eqRes, stRes, sysRes, subTypeRes, legacySubRes, wpRes] = await Promise.all([
        supabase.from('equipment').select('*').order('id', { ascending: true }).limit(5000),
        supabase.from('system_types').select('id,name').order('id', { ascending: true }).limit(1000),
        supabase.from('equipment_systems').select('id,name,system_type_id').order('id', { ascending: true }).limit(1000),
        supabase.from('subsystem_types').select('id,code,full_name').order('code', { ascending: true }).limit(3000),
        supabase.from('equipment_subsystems').select('id,name,description').order('id', { ascending: true }).limit(3000),
        supabase
          .from('workplace')
          .select('id,code,name,unit')
          .order('id', { ascending: true })
          .limit(1000),
      ])

      if (!active) return

      if (eqRes.error) {
        setError(eqRes.error.message || 'Не удалось загрузить equipment')
        setLoading(false)
        return
      }
      const dictErrors = [stRes.error, sysRes.error, subTypeRes.error, wpRes.error].filter(Boolean)
      if (dictErrors.length) {
        setError(dictErrors.map((e) => e.message).join(' · '))
      }

      const workplaceRows = wpRes.error ? [] : (wpRes.data || [])
      const scopedWorkplaces = unit ? workplaceRows.filter((row) => row?.unit === unit) : workplaceRows
      const allowedControlPoints = new Set(
        scopedWorkplaces
          .flatMap((row) => [row?.name, row?.code])
          .filter(Boolean)
          .map((value) => normalize(value).replace(/\s+/g, '').replace(/_/g, '')),
      )
      const scopedEquipment = unit
        ? (eqRes.data || []).filter((row) => {
            const rowUnit = normalize(row?.unit || row?.unit_code || '')
            if (rowUnit) return rowUnit === normalize(unit)
            const cp = normalize(row?.control_point).replace(/\s+/g, '').replace(/_/g, '')
            if (cp && allowedControlPoints.size) return allowedControlPoints.has(cp)
            return false
          })
        : (eqRes.data || [])

      setEquipment(scopedEquipment)
      if (!stRes.error) setSystemTypes(stRes.data || [])
      if (!sysRes.error) setSystems(sysRes.data || [])
      if (!subTypeRes.error) setSubsystemTypes(subTypeRes.data || [])
      if (!legacySubRes.error) setLegacySubsystems(legacySubRes.data || [])
      if (!wpRes.error) setWorkplaces(scopedWorkplaces)

      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase, unit])

  const rows = useMemo(() => {
    return (equipment || []).map((row) => {
      const system = systemById.get(String(row.system_id || ''))
      const subsystem = subsystemById.get(String(row.subsystem_type_id || row.subsystem_id || ''))
      const systemName = system?.name || row.equipment_system || 'Без системы'
      const typeName = systemTypeById.get(String(system?.system_type_id || '')) || 'Без типа'
      const subsystemName = subsystem?.name || 'Без подсистемы'
      const stationNumber = String(row.station_number || row.name || '').trim()
      return {
        ...row,
        systemName,
        typeName,
        subsystemName,
        stationNumber,
      }
    })
  }, [equipment, systemById, subsystemById, systemTypeById])

  const hierarchy = useMemo(() => {
    const typeMap = new Map()
    for (const row of rows) {
      if (!typeMap.has(row.typeName)) typeMap.set(row.typeName, new Map())
      const systemMap = typeMap.get(row.typeName)
      if (!systemMap.has(row.systemName)) systemMap.set(row.systemName, new Map())
      const subsystemMap = systemMap.get(row.systemName)
      if (!subsystemMap.has(row.subsystemName)) subsystemMap.set(row.subsystemName, [])
      subsystemMap.get(row.subsystemName).push(row)
    }
    return [...typeMap.entries()].map(([typeName, systemMap]) => ({
      typeName,
      systems: [...systemMap.entries()].map(([systemName, subsystemMap]) => ({
        systemName,
        subsystems: [...subsystemMap.entries()].map(([subsystemName, list]) => ({
          subsystemName,
          list: [...list].sort((a, b) => String(a.stationNumber).localeCompare(String(b.stationNumber), 'ru', { numeric: true })),
        })),
      })),
    }))
  }, [rows])

  const toggleSetValue = (setter, key) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getDraft = (row) => {
    const current = drafts[row.id]
    if (current) return current
    return {
      system_id: row.system_id || '',
      subsystem_type_id: row.subsystem_type_id || row.subsystem_id || '',
      station_number: row.stationNumber || '',
      control_point: row.control_point || '',
      status: row.status || 'работа',
    }
  }

  const setDraftField = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }))
  }

  const saveRow = async (row) => {
    const draft = getDraft(row)
    const payload = {
      status: draft.status,
      control_point: draft.control_point || null,
      station_number: draft.station_number || null,
    }

    if (hasColumn('system_id')) {
      payload.system_id = draft.system_id ? Number(draft.system_id) : null
      payload.equipment_system = systemById.get(String(draft.system_id || ''))?.name || row.equipment_system || null
    } else {
      payload.equipment_system = row.equipment_system || null
    }

    if (hasColumn('subsystem_type_id')) {
      payload.subsystem_type_id = draft.subsystem_type_id ? Number(draft.subsystem_type_id) : null
    } else if (hasColumn('subsystem_id')) {
      payload.subsystem_id = draft.subsystem_type_id ? Number(draft.subsystem_type_id) : null
    }

    setSavingId(row.id)
    setError('')
    const { error: saveError } = await supabase.from('equipment').update(payload).eq('id', row.id)
    setSavingId(null)
    if (saveError) {
      setError(saveError.message || 'Не удалось сохранить строку')
      return
    }

    setEquipment((prev) => prev.map((item) => (String(item.id) === String(row.id) ? { ...item, ...payload } : item)))
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  const addRow = async () => {
    const payload = {
      status: newRow.status || 'работа',
      control_point: newRow.control_point || null,
      station_number: newRow.station_number || null,
    }

    if (hasColumn('system_id')) {
      if (!newRow.system_id) {
        setError('Выберите систему из справочника equipment_systems.')
        return
      }
      payload.system_id = newRow.system_id ? Number(newRow.system_id) : null
      payload.equipment_system = systemById.get(String(newRow.system_id || ''))?.name || null
    } else {
      payload.equipment_system = null
    }

    if (hasColumn('subsystem_type_id')) {
      payload.subsystem_type_id = newRow.subsystem_type_id ? Number(newRow.subsystem_type_id) : null
    } else if (hasColumn('subsystem_id')) {
      payload.subsystem_id = newRow.subsystem_type_id ? Number(newRow.subsystem_type_id) : null
    }

    setAdding(true)
    setError('')
    const { data, error: addError } = await supabase.from('equipment').insert(payload).select('*').single()
    setAdding(false)

    if (addError) {
      setError(addError.message || 'Не удалось добавить строку')
      return
    }

    setEquipment((prev) => [...prev, data])
    setNewRow({
      system_id: '',
      subsystem_type_id: '',
      station_number: '',
      control_point: '',
      status: 'работа',
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-grayText">Оборудование</p>
        <h1 className="text-xl font-semibold text-dark">База оборудования{unit ? ` · ${unit.toUpperCase()}` : ''}</h1>
        <p className="mt-2 text-sm text-grayText">
          {loading ? 'Загрузка...' : `Строк в equipment: ${equipment.length}`}
        </p>
        {!loading && !systems.length && (
          <p className="mt-2 text-sm text-rose-500">
            Справочник `equipment_systems` пуст или недоступен. Заполните таблицу и проверьте RLS-политику чтения.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-rose-500">Ошибка: {error}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-lg">
        <p className="text-xs uppercase tracking-[0.18em] text-grayText">Добавить единицу</p>
        <div className="mt-2 grid gap-2 md:grid-cols-5">
          <select
            value={newRow.system_id}
            onChange={(e) => setNewRow((prev) => ({ ...prev, system_id: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Система</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>

          <select
            value={newRow.subsystem_type_id}
            onChange={(e) => setNewRow((prev) => ({ ...prev, subsystem_type_id: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Подсистема</option>
            {[...subsystemById.entries()].map(([id, info]) => (
              <option key={id} value={id}>
                {info.name}
              </option>
            ))}
          </select>

          <input
            value={newRow.station_number}
            onChange={(e) => setNewRow((prev) => ({ ...prev, station_number: e.target.value }))}
            placeholder="Станц. номер"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />

          <select
            value={newRow.control_point}
            onChange={(e) => setNewRow((prev) => ({ ...prev, control_point: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Щит / пост</option>
            {controlPointOptions.map((point) => (
              <option key={point.value} value={point.value}>
                {point.label}
              </option>
            ))}
          </select>

          <select
            value={newRow.status}
            onChange={(e) => setNewRow((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void addRow()}
          disabled={adding}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {adding ? 'Добавляем...' : 'Добавить'}
        </button>
      </div>

      <div className="space-y-3">
        {hierarchy.map((typeGroup) => {
          const typeKey = `type:${typeGroup.typeName}`
          const typeOpen = expandedTypes.has('all') || expandedTypes.has(typeKey)
          return (
            <div key={typeKey} className="rounded-2xl border border-border bg-white shadow-lg">
              <button
                onClick={() => toggleSetValue(setExpandedTypes, typeKey)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-dark">{typeGroup.typeName}</span>
                <span className="text-xs text-grayText">{typeOpen ? 'Скрыть' : 'Показать'}</span>
              </button>

              {typeOpen && (
                <div className="space-y-2 border-t border-border px-3 py-3">
                  {typeGroup.systems.map((systemGroup) => {
                    const systemKey = `system:${typeGroup.typeName}:${systemGroup.systemName}`
                    const systemOpen = expandedSystems.has(systemKey)
                    return (
                      <div key={systemKey} className="rounded-xl border border-border bg-background/60">
                        <button
                          onClick={() => toggleSetValue(setExpandedSystems, systemKey)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left"
                        >
                          <span className="text-sm font-semibold text-dark">{systemGroup.systemName}</span>
                          <span className="text-xs text-grayText">{systemOpen ? 'Скрыть' : 'Показать'}</span>
                        </button>

                        {systemOpen && (
                          <div className="space-y-2 border-t border-border px-2 py-2">
                            {systemGroup.subsystems.map((subGroup) => {
                              const subKey = `sub:${systemKey}:${subGroup.subsystemName}`
                              const subOpen = expandedSubsystems.has(subKey)
                              return (
                                <div key={subKey} className="rounded-lg border border-border bg-white">
                                  <button
                                    onClick={() => toggleSetValue(setExpandedSubsystems, subKey)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                                  >
                                    <span className="text-sm font-medium text-dark">{subGroup.subsystemName}</span>
                                    <span className="text-xs text-grayText">{subOpen ? 'Скрыть' : 'Показать'}</span>
                                  </button>

                                  {subOpen && (
                                    <div className="overflow-x-auto border-t border-border">
                                      <table className="min-w-full text-xs">
                                        <thead className="bg-background text-grayText">
                                          <tr>
                                            <th className="px-2 py-2 text-left">ID</th>
                                            <th className="px-2 py-2 text-left">Станц. номер</th>
                                            <th className="px-2 py-2 text-left">Щит</th>
                                            <th className="px-2 py-2 text-left">Статус</th>
                                            <th className="px-2 py-2 text-left">Действие</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {subGroup.list.map((row) => {
                                            const draft = getDraft(row)
                                            return (
                                              <tr key={row.id} className="border-t border-border">
                                                <td className="px-2 py-2 text-grayText">{row.id}</td>
                                                <td className="px-2 py-2">
                                                  <input
                                                    value={draft.station_number}
                                                    onChange={(e) => setDraftField(row.id, 'station_number', e.target.value)}
                                                    className="w-24 rounded border border-border bg-white px-2 py-1"
                                                  />
                                                </td>
                                                <td className="px-2 py-2">
                                                  <select
                                                    value={draft.control_point}
                                                    onChange={(e) => setDraftField(row.id, 'control_point', e.target.value)}
                                                    className="w-36 rounded border border-border bg-white px-2 py-1"
                                                  >
                                                    <option value="">—</option>
                                                    {controlPointOptions.map((point) => (
                                                      <option key={point.value} value={point.value}>
                                                        {point.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </td>
                                                <td className="px-2 py-2">
                                                  <select
                                                    value={draft.status}
                                                    onChange={(e) => setDraftField(row.id, 'status', e.target.value)}
                                                    className="rounded border border-border bg-white px-2 py-1"
                                                  >
                                                    {statuses.map((status) => (
                                                      <option key={status} value={status}>
                                                        {status}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </td>
                                                <td className="px-2 py-2">
                                                  <button
                                                    onClick={() => void saveRow(row)}
                                                    disabled={savingId === row.id}
                                                    className="rounded-full border border-border px-3 py-1 text-[11px] text-dark transition hover:border-accent/70 disabled:opacity-60"
                                                  >
                                                    {savingId === row.id ? '...' : 'Сохранить'}
                                                  </button>
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {!loading && hierarchy.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-grayText">
            В equipment нет данных.
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentPage
