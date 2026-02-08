import { useMemo } from 'react'
import { useProfile } from '../hooks/useProfile'

function UnionPage() {
  const { employee, status } = useProfile()

  const isMember = useMemo(() => !!employee?.union_member, [employee])

  if (status.loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-xl sm:p-8">
          <p className="text-sm text-grayText animate-pulse">Загружаем…</p>
        </div>
      </div>
    )
  }

  if (!isMember) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-xl space-y-3 sm:p-8">
          <h1 className="text-xl font-semibold text-dark">Профсоюз</h1>
          <p className="text-sm text-grayText">Доступ только для членов профсоюза.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl border border-eco/30 bg-eco-light p-6 shadow-xl space-y-4 sm:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-eco">Профсоюз</p>
            <h1 className="text-2xl font-semibold text-dark">Новости и услуги</h1>
            <p className="text-sm text-grayText">Информация доступна только для членов профсоюза.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-eco/30 bg-white p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-eco">Новости</p>
            <ul className="space-y-2 text-sm text-dark">
              <li className="rounded-xl border border-border bg-background px-3 py-2">Последние обновления профсоюза.</li>
              <li className="rounded-xl border border-border bg-background px-3 py-2">Ближайшие собрания и встречи.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-eco/30 bg-white p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-eco">Услуги</p>
            <ul className="space-y-2 text-sm text-dark">
              <li className="rounded-xl border border-border bg-background px-3 py-2">Правовая поддержка сотрудников.</li>
              <li className="rounded-xl border border-border bg-background px-3 py-2">Социальные программы и льготы.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnionPage
