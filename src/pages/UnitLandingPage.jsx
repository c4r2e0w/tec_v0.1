import { useParams, useNavigate } from 'react-router-dom'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-orange-500/20 to-slate-900' },
  chem: { name: 'Химический цех', color: 'from-cyan-500/20 to-slate-900' },
  electro: { name: 'Электроцех', color: 'from-emerald-500/20 to-slate-900' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-sky-500/20 to-slate-900' },
  fuel: { name: 'Цех топливоподачи', color: 'from-amber-500/20 to-slate-900' },
}

function UnitLandingPage() {
  const { unit } = useParams()
  const navigate = useNavigate()
  const data = units[unit]

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Подразделение</p>
        <p className="text-lg font-semibold text-white">Раздел не найден</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${data.color} p-8 shadow-xl shadow-sky-900/10`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Подразделение</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{data.name}</h1>
        <p className="mt-2 text-sm text-slate-200">
          Выберите секцию: персонал, оборудование или документация. Можно перейти сразу по кнопкам ниже.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => navigate(`/${unit}/personnel`)}
            className="rounded-full bg-sky-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Персонал
          </button>
          <button
            onClick={() => navigate(`/${unit}/equipment`)}
            className="rounded-full border border-white/10 px-4 py-2 text-slate-100 transition hover:border-sky-400/70 hover:text-white"
          >
            Оборудование
          </button>
          <button
            onClick={() => navigate(`/${unit}/docs`)}
            className="rounded-full border border-white/10 px-4 py-2 text-slate-100 transition hover:border-sky-400/70 hover:text-white"
          >
            Документация
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: 'Персонал', desc: 'Состав, контакты, роли' },
          { title: 'Оборудование', desc: 'Реестр, статусы, ППР' },
          { title: 'Документация', desc: 'Инструкции, регламенты, чек-листы' },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{card.title}</p>
            <p className="mt-2 text-slate-200">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UnitLandingPage
