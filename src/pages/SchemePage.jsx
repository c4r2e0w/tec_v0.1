import { useState } from 'react'

const equipment = [
  { id:'boilers', title:'КОТЕЛЬНЫЙ УЧАСТОК', x:35, y:75, w:275, entries:['БКЗ-420 №1','БКЗ-420 №2','БКЗ-420 №3','БКЗ-420 №4','БКЗ-420 №5','БКЗ-420 №6*','БКЗ-420 №7'] },
  { id:'steam', title:'ПАРОВЫЕ СИСТЕМЫ', x:345, y:75, w:285, entries:['Главный паропровод','РОУ / БРОУ','Коллектор 18 №1','Коллектор 18 №2','Коллектор 8 №1','Коллектор 8 №2'] },
  { id:'turbines', title:'ТУРБИННЫЙ УЧАСТОК', x:665, y:75, w:275, entries:['ПТ-60 · агрегат 1','ПТ-60 · агрегат 2','Т-100','Р-50','Т-185'] },
  { id:'water', title:'ПИТАТЕЛЬНЫЙ ТРАКТ', x:975, y:75, w:275, entries:['Деаэраторы №1–7','ПЭН №1–7','ПВД общест. №1–2'] },
]
const lanes = [
  { y:535, color:'#ef6c58', name:'ОСТРЫЙ ПАР', description:'Направление технологического цикла, без указания конкретных врезок' },
  { y:585, color:'#b08bf0', name:'ПАР 18 / 8', description:'Коллекторы показаны как отдельная система, соединения не подтверждены' },
  { y:635, color:'#35a4dc', name:'ПИТАТЕЛЬНАЯ ВОДА', description:'Условное направление возврата питательной воды' },
]
function SchemePage(){
  const [selected,setSelected]=useState(null)
  const [zoom,setZoom]=useState(1)
  const [query,setQuery]=useState('')
  const [showLanes,setShowLanes]=useState(true)
  return <main className="mx-auto max-w-full space-y-4 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-grayText">КТЦ · учебный проект</p><h1 className="text-2xl font-bold">Технологическая схема станции</h1><p className="mt-2 max-w-3xl text-sm text-grayText">Функциональная компоновка и условные магистрали. Не является исполнительной или оперативной схемой.</p></div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><input aria-label="Найти оборудование" placeholder="Найти оборудование" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border border-border bg-white p-2"/><label><input type="checkbox" checked={showLanes} onChange={e=>setShowLanes(e.target.checked)} /> Показать магистрали</label><button type="button" className="rounded-lg border border-border bg-white px-3 py-2" onClick={()=>setZoom(v=>Math.max(.6,Math.round((v-.1)*10)/10))}>−</button><span>{Math.round(zoom*100)}%</span><button type="button" className="rounded-lg border border-border bg-white px-3 py-2" onClick={()=>setZoom(v=>Math.min(1.8,Math.round((v+.1)*10)/10))}>+</button><button type="button" className="rounded-lg border border-border bg-white px-3 py-2" onClick={()=>{setZoom(1);setSelected(null);setQuery('')}}>Сброс</button></div>
    </header>
    <div className="overflow-auto rounded-2xl border border-border bg-slate-950 shadow-sm" aria-label="Технологическая карта">
      <div style={{width:1290*zoom,height:725*zoom}}>
        <svg viewBox="0 0 1290 725" width="100%" height="100%" role="group" aria-label="Котлы, паровые системы, турбины, питательный тракт и условные магистрали">
          <rect width="1290" height="725" fill="#0d1929"/>
          {equipment.map(zone=><g key={zone.id}>
            <rect x={zone.x} y={zone.y} width={zone.w} height="418" rx="14" fill="#14253a" stroke="#3d5874"/>
            <text x={zone.x+15} y={zone.y+29} fill="#93c5fd" fontSize="14" fontWeight="700">{zone.title}</text>
            {zone.entries.map((name,i)=>{const y=zone.y+49+i*49;const active=selected?.name===name;const match=name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'));return <g key={name} role="button" tabIndex={0} aria-label={name} style={{cursor:'pointer',opacity:match?1:.22}} onClick={()=>setSelected({name,zone:zone.title})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected({name,zone:zone.title})}}}><rect x={zone.x+12} y={y} width={zone.w-24} height="40" rx="7" fill={active?'#155e75':'#223b53'} stroke={active?'#22d3ee':'#47617c'}/><text x={zone.x+23} y={y+25} fill="#f1f5f9" fontSize="14">{name}</text></g>})}
          </g>)}
          {showLanes&&lanes.map(l=><g key={l.name}>
            <line x1="35" y1={l.y} x2="1250" y2={l.y} stroke={l.color} strokeWidth="3" strokeDasharray="12 9" opacity=".9"/>
            <rect x="40" y={l.y-18} width="230" height="25" rx="5" fill="#0d1929"/>
            <text x="48" y={l.y} fill={l.color} fontWeight="700" fontSize="15">{l.name}</text>
          </g>)}
          <text x="35" y="686" fill="#cbd5e1" fontSize="14">Пунктир = функциональная магистраль, НЕ подтверждённая трассировка или врезка.</text>
          <text x="35" y="707" fill="#94a3b8" fontSize="13">* Котёл №6 указан в исходном перечне, но отсутствует в текущем реестре оборудования.</text>
        </svg>
      </div>
    </div>
    <aside className="rounded-2xl border border-border bg-white p-4" aria-live="polite"><h2 className="font-semibold">{selected?.name||'Выбери оборудование на схеме'}</h2><p className="mt-1 text-sm text-grayText">{selected?.zone||'Нажми на блок для просмотра.'}</p><p className="mt-2 text-sm">Связи, параметры и арматура пока не подтверждены исходными чертежами. После сверки здесь появятся ссылки на конкретные инструкции и элементы трубопроводов.</p></aside>
  </main>
}
export default SchemePage
