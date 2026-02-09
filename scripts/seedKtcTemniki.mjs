import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const unit = 'ktc'

const temniki = [
  { day: 1, briefing: 'Организационные мероприятия при допуске по наряду.', round: 'Заземление механизмов (вентиляторы и двигатели на своей установке).' },
  { day: 2, briefing: 'Базовые и кардинальные принципы безопасности.', round: 'Проверка состояния и наличия СИЗ органов слуха у себя и других работников.' },
  { day: 3, briefing: 'СИЗ. Использование, назначение.', round: 'Состояние розеток (надписи, целостность).' },
  { day: 4, briefing: 'Требования безопасности к маршрутам движения персонала.', round: 'Содержание рабочего места в соответствии с методологией 5S.' },
  { day: 5, briefing: 'Группы основных знаков безопасности.', round: 'Знаки безопасности (наличие, состояние).' },
  { day: 6, briefing: 'Требования к защитным кожухам.', round: 'Состояние кожухов.' },
  { day: 7, briefing: 'Устройство порошкового огнетушителя, правила приведения его в действие.', round: 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).' },
  { day: 8, briefing: 'Требования охраны труда при обходах и осмотрах оборудования.', round: 'Состояние проходов (не загромождены).' },
  { day: 9, briefing: 'Правила освобождения пострадавшего от действия электрического тока.', round: 'Провода (изоляция, отсутствие свисающих).' },
  { day: 10, briefing: 'Правила безопасности при проведении огневых работ.', round: 'Состояние электросборок 380/220 В (наличие надписей, знаков, схем, заземлений).' },
  { day: 11, briefing: 'Правила безопасности при обслуживании оборудования.', round: 'Ограждающие конструкции, площадки (наличие, исправность).' },
  { day: 12, briefing: 'Требования безопасности к маршрутам движения персонала.', round: 'Перекрытия дренажных каналов (как закреплены, отсутствие коррозии, рифление).' },
  { day: 13, briefing: 'Правила безопасности при работе на высоте.', round: 'Надписи, диспетчерские наименования арматуры (наличие, состояние).' },
  { day: 14, briefing: 'Действия работника при выбросе хлора.', round: 'Противогазы (наличие дежурных, проверка личных, протирание).' },
  { day: 15, briefing: 'Опасные и вредные производственные факторы на рабочем месте.', round: 'Документация: ДИ, смежных цехов, станционные (наличие, актуальность, перечень).' },
  { day: 16, briefing: 'Правила безопасности при движении по участкам с недостаточной освещённостью.', round: 'Достаточная освещённость в цехе на рабочих местах.' },
  { day: 17, briefing: 'Правила безопасности при движении по лестницам.', round: 'Состояние лестниц.' },
  { day: 18, briefing: 'Ответственность производителя работ, членов бригады.', round: 'Манометры и уставки (калибровка, поверка, бирка, правильность работы).' },
  { day: 19, briefing: 'Чем опасен электрический ток и приближение к токоведущим частям.', round: 'Кнопки аварийного отключения насоса (наличие пломбы).' },
  { day: 20, briefing: 'Безопасное перемещение грузов.', round: 'Огнетушители (давление, пиктограммы, пломбы, шланг, корпус).' },
  { day: 21, briefing: 'Правила безопасности при обслуживании механизмов.', round: 'Насосы (режим работы, температура подшипников, вибрация, шум).' },
  { day: 22, briefing: 'Что обязан проходить работник в процессе работы.', round: 'Содержание рабочего места в соответствии с методологией 5S.' },
  { day: 23, briefing: 'Действия персонала при несчастном случае.', round: 'Аптечка (срок годности, перечень, препараты).' },
  { day: 24, briefing: 'Базовые принципы культуры безопасности.', round: 'Документация: ПИ (наличие, актуальность, перечень).' },
  { day: 25, briefing: 'Требования к пожарным кранам.', round: 'Проверка пожарных кранов (наличие пломбы, надписи телефона пожарной части, состояние вентиля).' },
  { day: 26, briefing: 'Тематика инструктажа по рекомендации «Сигнала тревоги».', round: 'Мониторы (правильная работа, отсутствие зависаний).' },
  { day: 27, briefing: 'Ответственность допускающего.', round: 'Состояние кожухов.' },
  { day: 28, briefing: 'Действия персонала при пожаре.', round: 'Документация по охране труда (наличие, актуальность, перечень).' },
  { day: 29, briefing: 'Требования ПБ к содержанию территории.', round: 'Заземление механизмов (вентиляторы и двигатели на своей установке).' },
  { day: 30, briefing: 'Необходимость применения СИЗ.', round: 'Проверка состояния и наличия каски с подбородочным ремнём.' },
]

function toDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return d.toISOString().slice(0, 10)
}

const now = new Date()
const year = now.getUTCFullYear()
const month = now.getUTCMonth() + 1
const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

const valid = temniki
  .map((t) => ({ ...t, date: toDate(year, month, t.day) }))
  .filter((t) => t.date)

if (!valid.length) {
  console.error('No valid days for current month')
  process.exit(1)
}

async function run() {
  const briefingRows = valid.map((t) => ({
    unit,
    month: monthStart,
    briefing_date: t.date,
    topic: t.briefing,
    materials: `Тема обхода: ${t.round}`,
    is_mandatory: true,
  }))

  const { error: briefingErr } = await supabase
    .from('briefing_topics')
    .upsert(briefingRows, { onConflict: 'unit,briefing_date' })

  if (briefingErr) throw briefingErr

  const itemRows = valid.map((t) => ({
    code: `ktc-daily-${String(t.day).padStart(3, '0')}`,
    name: t.round,
    description: `Ежедневный обход ТО КТЦ · день ${t.day}`,
    category: 'daily_round',
    unit,
    is_active: true,
  }))

  const { error: itemErr } = await supabase
    .from('inspection_items')
    .upsert(itemRows, { onConflict: 'code' })

  if (itemErr) throw itemErr

  const { data: items, error: itemsFetchErr } = await supabase
    .from('inspection_items')
    .select('id, code')
    .in('code', itemRows.map((i) => i.code))

  if (itemsFetchErr) throw itemsFetchErr

  const codeToItemId = new Map((items || []).map((i) => [i.code, i.id]))

  const planRows = valid.map((t) => ({
    plan_date: t.date,
    unit,
    briefing_topic_id: null,
    created_by: null,
  }))

  const { error: planErr } = await supabase
    .from('round_plans')
    .upsert(planRows, { onConflict: 'plan_date,unit' })

  if (planErr) throw planErr

  const { data: plans, error: plansFetchErr } = await supabase
    .from('round_plans')
    .select('id, plan_date')
    .eq('unit', unit)
    .in('plan_date', valid.map((t) => t.date))

  if (plansFetchErr) throw plansFetchErr

  const planByDate = new Map((plans || []).map((p) => [p.plan_date, p.id]))

  const planItemRows = valid
    .map((t) => {
      const planId = planByDate.get(t.date)
      const itemId = codeToItemId.get(`ktc-daily-${String(t.day).padStart(3, '0')}`)
      if (!planId || !itemId) return null
      return {
        plan_id: planId,
        item_id: itemId,
        sort_order: 10,
        required: true,
      }
    })
    .filter(Boolean)

  if (planItemRows.length) {
    const { error: planItemErr } = await supabase
      .from('round_plan_items')
      .upsert(planItemRows, { onConflict: 'plan_id,item_id' })

    if (planItemErr) throw planItemErr
  }

  console.log(`Seeded temniki: ${valid.length} days for ${year}-${String(month).padStart(2, '0')}`)
}

run().catch((e) => {
  console.error('Seed failed:', e.message || e)
  process.exit(1)
})
