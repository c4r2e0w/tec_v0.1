export const unitsList = [
  { key: 'ktc', title: 'Котлотурбинный цех', color: 'from-orange-500/20 to-slate-900' },
  { key: 'chem', title: 'Химический цех', color: 'from-cyan-500/20 to-slate-900' },
  { key: 'electro', title: 'Электроцех', color: 'from-emerald-500/20 to-slate-900' },
  { key: 'sai', title: 'Цех автоматики и измерений', color: 'from-sky-500/20 to-slate-900' },
  { key: 'fuel', title: 'Цех топливоподачи', color: 'from-amber-500/20 to-slate-900' },
]

export const unitsMap = Object.fromEntries(unitsList.map((u) => [u.key, u]))

export const sectionsMap = {
  personnel: 'Персонал',
  equipment: 'Оборудование',
  docs: 'Документация',
}
