export const unitsList = [
  { key: 'ktc', title: 'Котлотурбинный цех', color: 'from-primary/15 to-background' },
  { key: 'chem', title: 'Химический цех', color: 'from-accent/15 to-background' },
  { key: 'electro', title: 'Электроцех', color: 'from-eco/15 to-background' },
  { key: 'sai', title: 'Цех автоматики и измерений', color: 'from-primary/10 to-background' },
  { key: 'fuel', title: 'Цех топливоподачи', color: 'from-accent/10 to-background' },
]

export const unitsMap = Object.fromEntries(unitsList.map((u) => [u.key, u]))

export const sectionsMap = {
  personnel: 'Персонал',
  equipment: 'Оборудование',
  docs: 'Документация',
}
