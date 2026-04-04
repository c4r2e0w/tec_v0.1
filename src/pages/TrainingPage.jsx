function TrainingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
        <div className="bg-[linear-gradient(120deg,#0b1f17_0%,#123427_55%,#1c4e39_100%)] px-6 py-8 text-white sm:px-8">
          <p className="text-xs uppercase tracking-[0.28em] text-white/70">Обучение</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">Раздел в разработке</h2>
          <p className="mt-3 max-w-2xl text-sm text-white/85">
            Здесь появятся курсы, практические задания и трек прогресса сотрудников.
          </p>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
          {[
            { title: 'Курсы', text: 'Программы обучения по ролям и подразделениям' },
            { title: 'Практика', text: 'Кейсы, тренажеры и проверочные задания' },
            { title: 'Прогресс', text: 'Статус прохождения и результаты оценок' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-dark">{item.title}</p>
              <p className="mt-2 text-xs text-grayText">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TrainingPage
