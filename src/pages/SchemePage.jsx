import { useState } from 'react'

const groups = [
  { title: 'Котельное оборудование', hint: 'Парогенерация', items: ['БКЗ-420 №1', 'БКЗ-420 №2', 'БКЗ-420 №3', 'БКЗ-420 №4', 'БКЗ-420 №5', 'БКЗ-420 №6', 'БКЗ-420 №7'] },
  { title: 'Паровая часть', hint: 'Магистрали и распределение', items: ['Главный паропровод', 'Коллектор 18 кгс/см² · 1', 'Коллектор 18 кгс/см² · 2', 'Коллектор 8 кгс/см² · 1', 'Коллектор 8 кгс/см² · 2', 'РОУ / БРОУ'] },
  { title: 'Турбинное оборудование', hint: 'Преобразование энергии', items: ['ПТ-60 · 2 агрегата', 'Т-100 · 1 агрегат', 'Р-50 · 1 агрегат', 'Т-185 · 1 агрегат'] },
  { title: 'Питательный тракт', hint: 'Возврат воды в котлы', items: ['Деаэраторы №1–7', 'ПЭН №1–7', 'ПВД общестанционные №1–2'] },
]

function SchemePage() {
  const [selected, setSelected] = useState(null)
  return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-grayText">КТЦ · учебная технологическая карта</p>
      <h1 className="text-2xl font-bold text-dark">Тепловая схема станции</h1>
      <p className="max-w-3xl text-sm text-grayText">Первый компоновочный макет. Блоки размещены по функциональным зонам; реальные врезки, арматура и направления потоков будут нанесены только после сверки с документацией.</p>
    </header>
    <div className="grid gap-3 lg:grid-cols-4">
      {groups.map((group, i) => <section key={group.title} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 border-b border-border pb-3">
          <span className="text-xs font-semibold text-grayText">ЗОНА {String(i + 1).padStart(2, '0')}</span>
          <h2 className="mt-1 text-base font-semibold">{group.title}</h2>
          <p className="text-xs text-grayText">{group.hint}</p>
        </div>
        <div className="space-y-2">{group.items.map(item => <button key={item} type="button" onClick={() => setSelected({ item, group: group.title })} className={`block w-full rounded-xl border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-background ${selected?.item === item ? 'border-primary bg-background' : 'border-border'}`}>
          <span className="font-medium">{item}</span>
        </button>)}</div>
      </section>)}
    </div>
    <section aria-live="polite" className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">{selected ? selected.item : 'Выберите элемент схемы'}</h2>
      <p className="mt-1 text-sm text-grayText">{selected ? selected.group : 'Нажмите на любой блок, чтобы открыть его информационную панель.'}</p>
      <p className="mt-3 text-sm">Связи с соседним оборудованием и пункты инструкций пока не подтверждены исходными схемами. Данные не используются как оперативная схема.</p>
    </section>
    <p className="text-xs text-grayText">Примечание: состав оборудования взят из исходных требований проекта; это не отображение текущих рабочих состояний агрегатов.</p>
  </main>
}

export default SchemePage
