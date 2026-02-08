import { useParams, useNavigate } from 'react-router-dom'

const units = {
  ktc: { name: 'Котлотурбинный цех', color: 'from-primary/15 to-background' },
  chem: { name: 'Химический цех', color: 'from-accent/15 to-background' },
  electro: { name: 'Электроцех', color: 'from-eco/15 to-background' },
  sai: { name: 'Цех автоматики и измерений', color: 'from-primary/10 to-background' },
  fuel: { name: 'Цех топливоподачи', color: 'from-accent/10 to-background' },
}

function UnitLandingPage() {
  const { unit } = useParams()
  const navigate = useNavigate()
  const data = units[unit]

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-sm text-dark">
        <p className="text-xs uppercase tracking-[0.25em] text-grayText">Подразделение</p>
        <p className="text-lg font-semibold text-dark">Раздел не найден</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={`overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${data.color} p-6 shadow-xl sm:p-8`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-grayText">Подразделение</p>
        <h1 className="mt-3 text-3xl font-semibold text-dark">{data.name}</h1>
        <p className="mt-2 text-sm text-dark">
          Выберите секцию: персонал, оборудование или документация. Можно перейти сразу по кнопкам ниже.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => navigate(`/${unit}/personnel`)}
            className="rounded-full bg-primary px-4 py-2 font-semibold text-white transition hover:bg-primary-hover"
          >
            Персонал
          </button>
          <button
            onClick={() => navigate(`/${unit}/equipment`)}
            className="rounded-full border border-border px-4 py-2 text-dark transition hover:border-accent/70 hover:text-dark"
          >
            Оборудование
          </button>
          <button
            onClick={() => navigate(`/${unit}/docs`)}
            className="rounded-full border border-border px-4 py-2 text-dark transition hover:border-accent/70 hover:text-dark"
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
          <div key={card.title} className="rounded-2xl border border-border bg-white p-4 text-sm text-dark">
            <p className="text-xs uppercase tracking-[0.25em] text-grayText">{card.title}</p>
            <p className="mt-2 text-dark">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UnitLandingPage
