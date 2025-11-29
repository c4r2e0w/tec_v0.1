import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from '../hooks/useAuth'

function ProfilePage() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [form, setForm] = useState({
    full_name: '',
    department: '',
    role: '',
  })

  useEffect(() => {
    if (!user) return
    let active = true
    async function loadProfile() {
      setStatus({ loading: true, error: '', success: '' })
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, department, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        setStatus({ loading: false, error: error.message, success: '' })
        return
      }
      setForm({
        full_name: data?.full_name || user.user_metadata?.full_name || '',
        department: data?.department || '',
        role: data?.role || '',
      })
      setStatus({ loading: false, error: '', success: '' })
    }
    loadProfile()
    return () => {
      active = false
    }
  }, [supabase, user])

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSave = async () => {
    if (!user) return
    setStatus({ loading: true, error: '', success: '' })
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name || null,
      department: form.department || null,
      role: form.role || null,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setStatus({ loading: false, error: error.message, success: '' })
      return
    }
    setStatus({ loading: false, error: '', success: 'Профиль сохранён' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Профиль</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Ваш профиль</h1>
        <p className="text-sm text-slate-300">После входа вы можете обновить свои данные и контактную информацию.</p>
        {user && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <p>Email: {user.email}</p>
            <p className="text-xs text-slate-400">User ID: {user.id}</p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Редактирование</p>
            <h2 className="text-xl font-semibold text-white">Основные данные</h2>
          </div>
          {status.loading && <span className="text-xs text-slate-400">Сохраняем…</span>}
        </div>
        {status.error && <p className="mt-3 text-sm text-orange-300">Ошибка: {status.error}</p>}
        {status.success && <p className="mt-3 text-sm text-emerald-300">{status.success}</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            ФИО
            <input
              value={form.full_name}
              onChange={handleChange('full_name')}
              type="text"
              placeholder="Фамилия Имя Отчество"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
            />
          </label>
          <label className="text-sm text-slate-200">
            Отдел / участок
            <input
              value={form.department}
              onChange={handleChange('department')}
              type="text"
              placeholder="Цех, участок"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
            />
          </label>
          <label className="text-sm text-slate-200">
            Роль
            <input
              value={form.role}
              onChange={handleChange('role')}
              type="text"
              placeholder="operator / supervisor / admin"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={status.loading}
            className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Сохранить
          </button>
          <button
            onClick={() => setForm({ full_name: '', department: '', role: '' })}
            disabled={status.loading}
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Очистить
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
