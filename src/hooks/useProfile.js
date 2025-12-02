import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from './useAuth'
import { fetchProfileByUserId, upsertProfileLink } from '../api/profiles'
import {
  fetchChildrenByEmployee,
  fetchEmployeeById,
  insertChild,
  searchEmployees,
  deleteChild,
  updateChild,
  updateEmployee,
} from '../api/employees'

export function useProfile() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const queryClient = useQueryClient()

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
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLinked, setIsLinked] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [children, setChildren] = useState([])
  const [childrenDraft, setChildrenDraft] = useState([])
  const [childrenDeleted, setChildrenDeleted] = useState([])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400)
    return () => clearTimeout(id)
  }, [searchTerm])

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfileByUserId(supabase, user.id),
    enabled: !!user,
  })

  const employeeId = profileQuery.data?.data?.employee_id

  const employeeQuery = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => fetchEmployeeById(supabase, employeeId),
    enabled: !!employeeId,
  })

  const employeesSearchQuery = useQuery({
    queryKey: ['employees-search', debouncedSearch],
    queryFn: async () => {
      const { data, error } = await searchEmployees(supabase, debouncedSearch)
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: !isLinked && !!user,
    staleTime: 1000 * 30,
  })

  const childrenQuery = useQuery({
    queryKey: ['employee-children', employeeId],
    queryFn: async () => {
      const { data, error } = await fetchChildrenByEmployee(supabase, employeeId)
      if (error) throw new Error(error.message)
      return data || []
    },
    enabled: !!employeeId,
    staleTime: 1000 * 60,
  })

  useEffect(() => {
    if (!user) {
      setInitialLoading(false)
      setStatus({ loading: false, error: '', success: '' })
      return
    }
    if (profileQuery.isLoading) {
      setInitialLoading(true)
      setStatus({ loading: true, error: '', success: '' })
      return
    }
    if (profileQuery.error) {
      setStatus({ loading: false, error: profileQuery.error.message, success: '' })
      setInitialLoading(false)
      return
    }
    const linkedId = employeeId || ''
    setForm({ employeeId: linkedId })
    setIsLinked(!!linkedId)
    setEditMode(false)
    setStatus({ loading: false, error: '', success: '' })
    setInitialLoading(false)
  }, [employeeId, profileQuery.error, profileQuery.isLoading, user])

  useEffect(() => {
    if (employeeQuery.isLoading) return
    if (employeeQuery.error) {
      setStatus({ loading: false, error: employeeQuery.error.message, success: '' })
      return
    }
    const emp = employeeQuery.data?.data || null
    setEmployee(emp)
    setEmployeeForm({
      last_name: emp?.last_name || '',
      first_name: emp?.first_name || '',
      middle_name: emp?.middle_name || '',
      birth_date: emp?.birth_date || '',
      phone: emp?.phone || '',
    })
  }, [employeeQuery.data, employeeQuery.error, employeeQuery.isLoading])

  useEffect(() => {
    if (childrenQuery.isLoading || childrenQuery.error) return
    setChildren(childrenQuery.data || [])
    setChildrenDraft(
      (childrenQuery.data || []).map((child) => ({
        id: child.id,
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        middle_name: child.middle_name || '',
        birth_date: child.birth_date || '',
      })),
    )
    setChildrenDeleted([])
  }, [childrenQuery.data, childrenQuery.error, childrenQuery.isLoading])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error: linkError } = await upsertProfileLink(supabase, user.id, form.employeeId)
      if (linkError) throw new Error(linkError.message)

      if (form.employeeId && editMode) {
        const current = employee || {}
        const payload = {
          last_name: employeeForm.last_name || current.last_name || null,
          first_name: employeeForm.first_name || current.first_name || null,
          middle_name: employeeForm.middle_name || current.middle_name || null,
          birth_date: employeeForm.birth_date || current.birth_date || null,
          phone: employeeForm.phone || current.phone || null,
        }
        const { error: empErr } = await updateEmployee(supabase, Number(form.employeeId), payload)
        if (empErr) throw new Error(`Сотрудник не обновлён: ${empErr.message}`)

        if (childrenDraft && childrenDraft.length) {
          if (childrenDeleted && childrenDeleted.length) {
            for (const delId of childrenDeleted) {
              const { error: delErr } = await deleteChild(supabase, Number(delId))
              if (delErr) throw new Error(`Ребёнок не удалён: ${delErr.message}`)
            }
          }
          for (const child of childrenDraft) {
            const commonPayload = {
              first_name: child.first_name || null,
              last_name: child.last_name || null,
              middle_name: child.middle_name || null,
              birth_date: child.birth_date || null,
              id_employees: Number(form.employeeId),
            }
            if (String(child.id || '').startsWith('new-')) {
              const { error: insErr } = await insertChild(supabase, commonPayload)
              if (insErr) throw new Error(`Ребёнок не добавлен: ${insErr.message}`)
            } else if (child.id) {
              const { error: updErr } = await updateChild(supabase, Number(child.id), commonPayload)
              if (updErr) throw new Error(`Ребёнок не обновлён: ${updErr.message}`)
            }
          }
        }
      }
      return form.employeeId
    },
    onMutate: () => setStatus({ loading: true, error: '', success: '' }),
    onError: (err) => setStatus({ loading: false, error: err.message, success: '' }),
    onSuccess: async (empId) => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      if (empId) {
        await queryClient.invalidateQueries({ queryKey: ['employee', Number(empId)] })
        await queryClient.invalidateQueries({ queryKey: ['employee-children', Number(empId)] })
        setIsLinked(true)
      } else {
        setIsLinked(false)
      }
      setEditMode(false)
      setStatus({ loading: false, error: '', success: 'Сохранено' })
      setChildrenDeleted([])
    },
  })

  const handleSave = () => {
    if (!user) return
    saveMutation.mutate()
  }

  const handleUnlink = () => {
    if (!user) return
    setForm({ employeeId: '' })
    setEmployee(null)
    setEmployeeForm({ last_name: '', first_name: '', middle_name: '', birth_date: '', phone: '' })
    setIsLinked(false)
    setEditMode(false)
    setStatus({ loading: false, error: '', success: '' })
    upsertProfileLink(supabase, user.id, null).finally(() => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    })
    setChildren([])
    setChildrenDraft([])
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
    employees: employeesSearchQuery.data || [],
    employeesError: employeesSearchQuery.error?.message || '',
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
    childrenLoading: childrenQuery.isLoading,
    childrenDraft,
    setChildrenDraft,
    setChildrenDeleted,
  }
}
