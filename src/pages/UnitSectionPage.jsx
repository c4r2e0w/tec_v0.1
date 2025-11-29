import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

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

  const bg = unitData?.color || 'from-slate-800 to-slate-900'

  const subtitle = useMemo(() => {
    if (!unitData || !sectionLabel) return 'Раздел не найден'
    if (section === 'personnel') return 'Состав смены, контакты, роли'
    if (section === 'equipment') return 'Реестр оборудования, статус и ППР'
    if (section === 'docs') return 'Инструкции, регламенты, чек-листы'
    return ''
  }, [unitData, sectionLabel, section])

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
