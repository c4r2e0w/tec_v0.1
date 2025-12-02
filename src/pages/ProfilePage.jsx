import { useProfile } from '../hooks/useProfile'
import { formatAge } from '../lib/formatAge'

function ProfilePage() {
  const {
    user,
    status,
    form,
    setForm,
    employee,
    employeeForm,
    setEmployeeForm,
    employees,
    employeesError,
    searchTerm,
    setSearchTerm,
    isLinked,
    editMode,
    setEditMode,
    initialLoading,
    handleSave,
    handleUnlink,
    resetEmployeeForm,
    fio,
    divisionText,
    children,
    childrenLoading,
    childrenDraft,
    setChildrenDraft,
    setChildrenDeleted,
  } = useProfile()

  const normalize = (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v.trim()
    return String(v).trim()
  }
  const employeeChanged =
    !!employee &&
    (normalize(employeeForm.last_name) !== normalize(employee.last_name) ||
      normalize(employeeForm.first_name) !== normalize(employee.first_name) ||
      normalize(employeeForm.middle_name) !== normalize(employee.middle_name) ||
      normalize(employeeForm.phone) !== normalize(employee.phone) ||
      normalize(employeeForm.birth_date) !== normalize(employee.birth_date))

  const childrenChanged = () => {
    if (!childrenDraft || !children) return false
    if (childrenDraft.length !== children.length) return true
    for (const child of childrenDraft) {
      if (String(child.id || '').startsWith('new-')) return true
      const original = children.find((c) => c.id === child.id)
      if (!original) return true
      if (
        normalize(child.first_name) !== normalize(original.first_name) ||
        normalize(child.last_name) !== normalize(original.last_name) ||
        normalize(child.middle_name) !== normalize(original.middle_name) ||
        normalize(child.birth_date) !== normalize(original.birth_date)
      ) {
        return true
      }
    }
    return false
  }

  const hasProfileChanges = editMode && (employeeChanged || childrenChanged())

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
          <p className="text-sm text-slate-300 animate-pulse">Загружаем профиль…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Профиль</p>
            <div className="flex flex-wrap items-start gap-2">
              <h2 className="text-xl font-semibold text-white leading-tight break-words">{fio}</h2>
              {employee?.union_member && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  🏅 Профсоюз
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end md:gap-3">
            {status.loading && <span className="text-xs text-slate-400">Сохраняем…</span>}
            {isLinked && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white"
              >
                Править
              </button>
            )}
            {isLinked && editMode && (
              <>
                <button
                  onClick={handleSave}
                  disabled={!hasProfileChanges || status.loading}
                  className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setEditMode(false)
                    resetEmployeeForm()
                  }}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  onClick={handleUnlink}
                  className="rounded-full border border-red-400/60 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300 hover:bg-red-500/20"
                >
                  Отвязать
                </button>
              </>
            )}
          </div>
        </div>

        {status.error && <p className="text-sm text-orange-300">Ошибка: {status.error}</p>}
        {status.success && <p className="text-sm text-emerald-300">{status.success}</p>}

        <div className="space-y-2 text-sm text-slate-200">
          {isLinked ? (
            editMode ? (
              <>
                <p className="text-xs text-slate-400">Подразделение: {divisionText}</p>
                <input
                  value={employeeForm.last_name}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  type="text"
                  placeholder="Фамилия"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
                <input
                  value={employeeForm.first_name}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  type="text"
                  placeholder="Имя"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
                <input
                  value={employeeForm.middle_name}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, middle_name: e.target.value }))}
                  type="text"
                  placeholder="Отчество"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
                <input
                  value={user?.email || ''}
                  readOnly
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-400 outline-none"
                />
                <input
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
                  type="text"
                  placeholder="Телефон"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
                <input
                  value={employeeForm.birth_date}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                  type="date"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                />
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Дети</p>
                    <button
                      type="button"
                      onClick={() =>
                        setChildrenDraft((prev) => [
                          ...prev,
                          {
                            id: `new-${Date.now()}`,
                            first_name: '',
                            last_name: '',
                            middle_name: '',
                            birth_date: '',
                          },
                        ])
                      }
                      className="text-[11px] text-sky-300 hover:text-sky-200"
                    >
                      + Добавить
                    </button>
                  </div>
                  {childrenDraft && childrenDraft.length > 0 ? (
                    <div className="space-y-2">
                      {childrenDraft.map((child) => (
                        <div key={child.id} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] items-center">
                          <input
                            value={child.last_name}
                            onChange={(e) =>
                              setChildrenDraft((prev) =>
                                prev.map((c) => (c.id === child.id ? { ...c, last_name: e.target.value } : c)),
                              )
                            }
                            type="text"
                            placeholder="Фамилия"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                          />
                          <input
                            value={child.first_name}
                            onChange={(e) =>
                              setChildrenDraft((prev) =>
                                prev.map((c) => (c.id === child.id ? { ...c, first_name: e.target.value } : c)),
                              )
                            }
                            type="text"
                            placeholder="Имя"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                          />
                          <input
                            value={child.middle_name}
                            onChange={(e) =>
                              setChildrenDraft((prev) =>
                                prev.map((c) => (c.id === child.id ? { ...c, middle_name: e.target.value } : c)),
                              )
                            }
                            type="text"
                            placeholder="Отчество"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                          />
                          <input
                            value={child.birth_date}
                            onChange={(e) =>
                              setChildrenDraft((prev) =>
                                prev.map((c) => (c.id === child.id ? { ...c, birth_date: e.target.value } : c)),
                              )
                            }
                            type="date"
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setChildrenDraft((prev) => prev.filter((c) => c.id !== child.id))
                              if (!String(child.id).startsWith('new-')) {
                                setChildrenDeleted((prev) => [...prev, child.id])
                              }
                            }}
                            className="text-[11px] text-red-300 hover:text-red-200"
                          >
                            Удалить
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Дети не указаны. Добавьте запись.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">Подразделение: {divisionText}</p>
                <p className="text-xs text-slate-400">Должность: {employee?.positions?.name || employee?.position_id || '—'}</p>
                <p className="text-xs text-slate-400">Почта: {user?.email || '—'}</p>
                <p className="text-xs text-slate-400">Телефон: {employee?.phone || '—'}</p>
                <p className="text-xs text-slate-400">Дата рождения: {employee?.birth_date || '—'}</p>
                <div className="pt-1 text-xs text-slate-300">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Дети</p>
                  {childrenLoading ? (
                    <p className="text-slate-400">Загружаем…</p>
                  ) : children && children.length > 0 ? (
                    <ul className="space-y-1">
                      {children.map((child) => (
                        <li key={child.id} className="text-slate-300">
                          {[child.last_name, child.first_name, child.middle_name].filter(Boolean).join(' ')} — {formatAge(child.birth_date)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400">Данные о детях не указаны</p>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Введите свою фамилию/имя, выберите себя из списка и нажмите «Сохранить привязку».</p>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                type="text"
                placeholder="Поиск по фамилии/имени"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
              />
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ employeeId: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
              >
                <option value="">Не выбрано</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {[emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
              {employeesError && <p className="text-xs text-orange-300">Не удалось загрузить список: {employeesError}</p>}
              {!employeesError && employees.length === 0 && <p className="text-xs text-slate-400">Список пуст или нет доступа по RLS.</p>}
              <button
                onClick={handleSave}
                disabled={status.loading}
                className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Сохранить привязку
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
