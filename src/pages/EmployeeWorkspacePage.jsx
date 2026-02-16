import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseProvider'

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .trim()

const inferUnitCode = (text) => {
  const value = normalize(text)
  if (value.includes('котлотурбин')) return 'ktc'
  if (value.includes('хим')) return 'chem'
  if (value.includes('электро')) return 'electro'
  if (value.includes('автомат')) return 'sai'
  if (value.includes('топлив')) return 'fuel'
  return 'ktc'
}

function EmployeeWorkspacePage() {
  const { employeeId } = useParams()
  const supabase = useSupabase()
  const [employee, setEmployee] = useState(null)
  const [employeeError, setEmployeeError] = useState('')
  const [loadingEmployee, setLoadingEmployee] = useState(true)
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)

  const employeeFio = useMemo(
    () =>
      employee
        ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
        : '',
    [employee],
  )
  const preferredUnit = useMemo(
    () => inferUnitCode(employee?.positions?.devision_name || employee?.positions?.departament_name || ''),
    [employee],
  )

  useEffect(() => {
    let active = true
    async function loadEmployee() {
      setLoadingEmployee(true)
      setEmployeeError('')
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, middle_name, positions:position_id(name, type, devision_name, departament_name)')
        .eq('id', Number(employeeId))
        .maybeSingle()
      if (!active) return
      if (error) {
        setEmployeeError(error.message || 'Не удалось загрузить сотрудника')
        setEmployee(null)
      } else {
        setEmployee(data || null)
      }
      setLoadingEmployee(false)
    }
    void loadEmployee()
    return () => {
      active = false
    }
  }, [employeeId, supabase])

  useEffect(() => {
    let active = true
    async function loadPosts() {
      setLoadingPosts(true)
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, type, unit, created_at, created_by_employee_id')
        .eq('created_by_employee_id', Number(employeeId))
        .order('created_at', { ascending: false })
        .limit(10)
      if (!active) return
      if (error) {
        setPosts([])
      } else {
        setPosts(data || [])
      }
      setLoadingPosts(false)
    }
    void loadPosts()
    return () => {
      active = false
    }
  }, [employeeId, supabase])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Страница сотрудника</p>
        {loadingEmployee && <p className="mt-2 text-sm text-slate-300">Загрузка профиля…</p>}
        {!loadingEmployee && employee && (
          <>
            <h2 className="mt-2 text-xl font-semibold text-white">{employeeFio}</h2>
            <p className="mt-1 text-xs text-slate-400">{employee.positions?.name || 'Должность не указана'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {employee.positions?.devision_name || '—'} · {employee.positions?.departament_name || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/${preferredUnit}/personnel`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                Календарь подразделения
              </Link>
              <Link
                to="/"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:border-sky-400/60"
              >
                На главную
              </Link>
            </div>
          </>
        )}
        {!loadingEmployee && !employee && (
          <p className="mt-2 text-sm text-rose-300">{employeeError || 'Сотрудник не найден'}</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Публикации и действия</h3>
        {loadingPosts && <p className="mt-3 text-xs text-slate-400">Загружаем активность…</p>}
        {!loadingPosts && !posts.length && (
          <p className="mt-3 text-xs text-slate-500">Пока нет публикаций в ленте от этого сотрудника.</p>
        )}
        <div className="mt-3 space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-white">{post.title || 'Запись'}</p>
              <p className="mt-1 text-xs text-slate-300">{post.body || '—'}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                {post.type || 'info'} · {post.unit || 'общий'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmployeeWorkspacePage
