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
  const [info, setInfo] = useState('')

  const emailTrimmed = email.trim().toLowerCase()
  const passwordTrimmed = password.trim()
  const canSubmit = !!emailTrimmed && !!passwordTrimmed && !pending

  const handleLogin = async () => {
    if (!canSubmit) {
      setError('Введите email и пароль')
      return
    }
    setPending(true)
    setError('')
    setInfo('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: emailTrimmed, password: passwordTrimmed })
    if (err) setError(err.message)
    else navigate('/')
    setPending(false)
  }

  const handleSignUp = async () => {
    if (!canSubmit) {
      setError('Для регистрации введите email и пароль')
      return
    }
    setPending(true)
    setError('')
    setInfo('')
    const { data, error: err } = await supabase.auth.signUp({ email: emailTrimmed, password: passwordTrimmed })
    if (err) {
      setError(err.message)
    } else {
      const needsConfirm = data?.user?.identities?.[0]?.identity_data?.email
      setInfo(needsConfirm ? 'Проверьте почту: отправили ссылку для завершения регистрации.' : 'Аккаунт создан, можно войти.')
    }
    setPending(false)
  }

  const handleLogout = async () => {
    setPending(true)
    await supabase.auth.signOut()
    setPending(false)
    navigate('/login')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 rounded-3xl border border-border bg-white p-6 shadow-xl sm:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-grayText">Доступ</p>
        <h1 className="text-2xl font-semibold text-dark">Вход в портал</h1>
        <p className="text-sm text-grayText">
          Используйте корпоративный аккаунт. Проверка ролей подключим после базового входа.
        </p>
      </div>
      <div className="grid gap-3">
        <label className="text-sm text-dark">
          Email
          <input
            type="email"
            placeholder="you@tpp.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark outline-none transition focus:border-accent"
          />
        </label>
        <label className="text-sm text-dark">
          Пароль
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-dark outline-none transition focus:border-accent"
          />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <button
          disabled={!canSubmit}
          onClick={handleLogin}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? 'Входим...' : 'Войти'}
        </button>
        <button
          disabled={!user || pending}
          onClick={handleLogout}
          className="rounded-full border border-border px-4 py-2 text-sm text-dark transition hover:border-accent/70 hover:text-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Выйти
        </button>
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-xs text-dark">
          <p className="text-[11px] uppercase tracking-[0.2em] text-grayText">Авторизация новых пользователей</p>
          <p className="mt-1 text-grayText">
            Введите корпоративный email и придумайте пароль, нажмите «Создать аккаунт». Подтвердите письмо в почте, затем войдите.
          </p>
          <button
            disabled={!canSubmit}
            onClick={handleSignUp}
            className="mt-3 w-full rounded-full border border-emerald-400/60 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? 'Отправляем...' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-orange-300">Ошибка: {error}</p>}
      {info && <p className="text-xs text-emerald-300">{info}</p>}
      {user && !loading && <p className="text-xs text-emerald-300">Уже вошли как {user.email}</p>}
      <p className="text-xs text-grayText">Supabase Auth уже работает; проверку ролей добавим позднее.</p>
    </div>
  )
}

export default LoginPage
