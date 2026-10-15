import { useState } from 'react'

const zones = [
  { id: 'boilers', title: 'КОТЛЫ · БКЗ-420', x: 36, y: 54, w: 360, h: 510, items: ['Котёл №1', 'Котёл №2', 'Котёл №3', 'Котёл №4', 'Котёл №5', 'Котёл №6', 'Котёл №7'] },
  { id: 'steam', title: 'ПАРОВЫЕ МАГИСТРАЛИ', x: 426, y: 54, w: 360, h: 510, items: ['Главный паропровод', 'Коллектор 18 кгс/см² №1', 'Коллектор 18 кгс/см² №2', 'Коллектор 8 кгс/см² №1', 'Коллектор 8 кгс/см² №2', 'РОУ / БРОУ'] },
  { id: 'turbines', title: 'ТУРБИНЫ', x: 816, y: 54, w: 360, h: 510, items: ['ПТ-60 · агрегат 1', 'ПТ-60 · агрегат 2', 'Т-100', 'Р-50', 'Т-185'] },
  { id: 'feedwater', title: 'ПИТАТЕЛЬНЫЙ ТРАКТ', x: 1206, y: 54, w: 360, h: 510, items: ['Деаэраторы №1–7', 'ПЭН №1–7', 'ПВД общестанционные №1–2'] },
]

function SchemePage() {
  const [selected, setSelected] = useState(null)
  const [scale, setScale] = useState(1)
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('ru')
  return <main className="mx-auto max-w-full space-y-4 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-grayText">КТЦ · технологическая карта</p>
        <h1 className="mt-1 text-2xl font-bold">Тепловая схема станции</h1>
        <p className="mt-2 max-w-3xl text-sm text-grayText">Чистая компоновка без условных пересечений. Соединения и направления потоков будут добавлены после проверки первичных схем.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Поиск <input aria-label="Поиск оборудования" className="ml-2 w-44 rounded-lg border border-border bg-white p-2" value={query} onChange={e => setQuery(e.target.value)} placeholder="ПЭН, котёл, пар…" /></label>
        <label className="text-sm">Масштаб <input aria-label="Масштаб схемы" className="ml-2 align-middle" type="range" min="0.65" max="1.6" step="0.05" value={scale} onChange={e => setScale(Number(e.target.value))} /></label>
        <button type="button" onClick={() => { setScale(1); setQuery(''); setSelected(null) }} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">Сбросить</button>
      </div>
    </header>
    <div className="overflow-auto rounded-2xl border border-border bg-white shadow-sm" aria-label="Компоновка технологической схемы">
      <div style={{ width: 1600 * scale, height: 610 * scale }}>
        <svg viewBox="0 0 1600 610" width="100%" height="100%" role="img" aria-label="Четыре зоны станции: котлы, паровые магистрали, турбины и питательный тракт">
          <rect width="1600" height="610" fill="#f8fafc" />
          {zones.map(zone => <g key={zone.id}>
            <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
            <rect x={zone.x} y={zone.y} width={zone.w} height="58" rx="18" fill="#e2e8f0" />
            <rect x={zone.x} y={zone.y + 38} width={zone.w} height="20" fill="#e2e8f0" />
            <text x={zone.x + 18} y={zone.y + 35} fontSize="17" fontWeight="700" fill="#0f172a">{zone.title}</text>
            {zone.items.map((item, index) => {
              const x = zone.x + 16, y = zone.y + 76 + index * 58
              const matched = !normalized || item.toLocaleLowerCase('ru').includes(normalized)
              const active = selected?.id === zone.id && selected?.item === item
              return <g key={item} role="button" tabIndex={0} aria-label={item} onClick={() => setSelected({ id: zone.id, item, zone: zone.title })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ id: zone.id, item, zone: zone.title }) } }} style={{ cursor: 'pointer', opacity: matched ? 1 : 0.25 }}>
                <rect x={x} y={y} width={zone.w - 32} height="46" rx="9" fill={active ? '#dbeafe' : '#f1f5f9'} stroke={active ? '#2563eb' : '#cbd5e1'} strokeWidth={active ? 2 : 1} />
                <text x={x + 14} y={y + 29} fontSize="16" fill="#0f172a">{item}</text>
              </g>
            })}
          </g>)}
          <text x="36" y="594" fontSize="14" fill="#64748b">МАКЕТ · соединения не нанесены · не использовать для оперативных переключений</text>
        </svg>
      </div>
    </div>
    <aside className="rounded-2xl border border-border bg-white p-5" aria-live="polite">
      <h2 className="font-semibold">{selected ? selected.item : 'Выберите оборудование на схеме'}</h2>
      <p className="mt-1 text-sm text-grayText">{selected ? selected.zone : 'Нажмите на блок для просмотра сведений.'}</p>
      <p className="mt-2 text-sm">Параметры, арматура, соединения и ссылки на пункты инструкций будут добавляться только по проверенным исходным документам.</p>
    </aside>
  </main>
}

export default SchemePage
