import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from '../hooks/useAuth'

function LoginPage() {
  const supabase = useSupabase()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const handleLogin = async () => {
    setPending(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    else navigate('/')
    setPending(false)
  }

  const handleLogout = async () => {
    setPending(true)
    await supabase.auth.signOut()
    setPending(false)
    navigate('/login')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Доступ</p>
        <h1 className="text-2xl font-semibold text-white">Вход в портал</h1>
        <p className="text-sm text-slate-300">
          Используйте корпоративный аккаунт. Проверка ролей подключим после базового входа.
        </p>
      </div>
      <div className="grid gap-3">
        <label className="text-sm text-slate-200">
          Email
          <input
            type="email"
            placeholder="you@tpp.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
          />
        </label>
        <label className="text-sm text-slate-200">
          Пароль
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400"
          />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <button
          disabled={pending}
          onClick={handleLogin}
          className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? 'Входим...' : 'Войти'}
        </button>
        <button
          disabled={!user || pending}
          onClick={handleLogout}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-400/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Выйти
        </button>
      </div>
      {error && <p className="text-xs text-orange-300">Ошибка: {error}</p>}
      {user && !loading && <p className="text-xs text-emerald-300">Уже вошли как {user.email}</p>}
      <p className="text-xs text-slate-400">Позже сюда подключим Supabase Auth и проверку ролей.</p>
    </div>
  )
}

export default LoginPage
