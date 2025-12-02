import { useEffect, useMemo, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from './useAuth'
import { fetchProfileByUserId, upsertProfileLink } from '../api/profiles'
import { fetchEmployeeById, searchEmployees, updateEmployee } from '../api/employees'

export function useProfile() {
  const supabase = useSupabase()
  const { user } = useAuth()

  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [form, setForm] = useState({ employeeId: '' })
  const [employee, setEmployee] = useState(null)
  const [employeeForm, setEmployeeForm] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    birth_date: '',
    phone: '',
  })
  const [employees, setEmployees] = useState([])
  const [employeesError, setEmployeesError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLinked, setIsLinked] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setInitialLoading(false)
      return
    }
    let active = true
    async function loadProfile() {
      setInitialLoading(true)
      setStatus({ loading: true, error: '', success: '' })
      const { data: profileData, error: profileError } = await fetchProfileByUserId(supabase, user.id)
      if (!active) return
      if (profileError) {
        setStatus({ loading: false, error: profileError.message, success: '' })
        setInitialLoading(false)
        return
      }

      if (profileData?.employee_id) {
        const { data: emp, error: empErr } = await fetchEmployeeById(supabase, profileData.employee_id)
        if (!active) return
        if (empErr) {
          setStatus({ loading: false, error: empErr.message, success: '' })
          setInitialLoading(false)
          return
        }
        setEmployee(emp || null)
        setEmployeeForm({
          last_name: emp?.last_name || '',
          first_name: emp?.first_name || '',
          middle_name: emp?.middle_name || '',
          birth_date: emp?.birth_date || '',
          phone: emp?.phone || '',
        })
        setForm({ employeeId: profileData.employee_id })
        setIsLinked(true)
        setEditMode(false)
      } else {
        setForm({ employeeId: '' })
        setEmployee(null)
        setEmployeeForm({ last_name: '', first_name: '', middle_name: '', birth_date: '', phone: '' })
        setIsLinked(false)
        setEditMode(false)
      }
      setStatus({ loading: false, error: '', success: '' })
      setInitialLoading(false)
    }
    loadProfile()
    return () => {
      active = false
    }
  }, [supabase, user])

  useEffect(() => {
    if (!user) return
    let active = true
    async function loadList() {
      const term = searchTerm.trim()
      const { data, error } = await searchEmployees(supabase, term)
      if (!active) return
      if (error) {
        setEmployeesError(error.message)
        setEmployees([])
      } else {
        setEmployeesError('')
        setEmployees(data || [])
      }
    }
    loadList()
    return () => {
      active = false
    }
  }, [searchTerm, supabase, user])

  const handleSave = async () => {
    if (!user) return
    setStatus({ loading: true, error: '', success: '' })
    const { error } = await upsertProfileLink(supabase, user.id, form.employeeId)
    if (error) {
      setStatus({ loading: false, error: error.message, success: '' })
      return
    }

    if (form.employeeId) {
      const current = employee || {}
      if (editMode) {
        const payload = {
          last_name: employeeForm.last_name || current.last_name || null,
          first_name: employeeForm.first_name || current.first_name || null,
          middle_name: employeeForm.middle_name || current.middle_name || null,
          birth_date: employeeForm.birth_date || current.birth_date || null,
          phone: employeeForm.phone || current.phone || null,
        }
        const { error: empErr } = await updateEmployee(supabase, Number(form.employeeId), payload)
        if (empErr) {
          setStatus({ loading: false, error: `Сотрудник не обновлён: ${empErr.message}`, success: '' })
          return
        }
      }
      const { data: refreshedEmp } = await supabase
        .from('employees')
        .select(
          `
          id,
          first_name,
          last_name,
          middle_name,
          position_id,
          birth_date,
          phone,
          positions:position_id ( name, departament_name, devision_name )
        `,
        )
        .eq('id', Number(form.employeeId))
        .maybeSingle()
      setEmployee(refreshedEmp || null)
      setEmployeeForm({
        last_name: refreshedEmp?.last_name || '',
        first_name: refreshedEmp?.first_name || '',
        middle_name: refreshedEmp?.middle_name || '',
        birth_date: refreshedEmp?.birth_date || '',
        phone: refreshedEmp?.phone || '',
      })
      setIsLinked(true)
      setEditMode(false)
      setStatus({ loading: false, error: '', success: 'Сохранено' })
      return
    }

    setStatus({ loading: false, error: '', success: 'Сохранено' })
    setEditMode(false)
  }

  const handleUnlink = () => {
    setForm({ employeeId: '' })
    setEmployee(null)
    setEmployeeForm({ last_name: '', first_name: '', middle_name: '', birth_date: '', phone: '' })
    setIsLinked(false)
    setEditMode(false)
    setStatus({ loading: false, error: '', success: '' })
  }

  const resetEmployeeForm = () => {
    setEmployeeForm({
      last_name: employee?.last_name || '',
      first_name: employee?.first_name || '',
      middle_name: employee?.middle_name || '',
      birth_date: employee?.birth_date || '',
      phone: employee?.phone || '',
    })
  }

  const fio = useMemo(
    () => (employee ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ') : 'Профиль не привязан'),
    [employee],
  )

  const divisionText = useMemo(() => {
    if (!employee) return '—'
    const division = employee.positions?.devision_name || '—'
    const department = employee.positions?.departament_name ? ` ${employee.positions.departament_name}` : ''
    return `${division}${department}`
  }, [employee])

  return {
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
  }
}
