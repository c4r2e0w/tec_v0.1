import { useProfile } from '../hooks/useProfile'

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
  } = useProfile()

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Профиль</p>
            <h2 className="text-xl font-semibold text-white">{fio}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
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
                  className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
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
                  className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-100 transition hover:border-sky-400/70 hover:text-white"
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
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">Подразделение: {divisionText}</p>
                <p className="text-xs text-slate-400">Должность: {employee?.positions?.name || employee?.position_id || '—'}</p>
                <p className="text-xs text-slate-400">Почта: {user?.email || '—'}</p>
                <p className="text-xs text-slate-400">Телефон: {employee?.phone || '—'}</p>
                <p className="text-xs text-slate-400">Дата рождения: {employee?.birth_date || '—'}</p>
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
