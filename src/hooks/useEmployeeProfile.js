/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from './useAuth'

export function useEmployeeProfile() {
  const { user } = useAuth()
  const supabase = useSupabase()
  const [state, setState] = useState({ loading: true, error: '', profile: null, employee: null })

  useEffect(() => {
    if (!user) {
      setState({ loading: false, error: '', profile: null, employee: null })
      return
    }
    let active = true
    async function fetchProfile() {
      setState({ loading: true, error: '', profile: null, employee: null })

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          employee_id,
          employee:employee_id (
            id,
            first_name,
            last_name,
            middle_name,
            position_id,
            positions:position_id ( name )
          )
        `,
        )
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (profileError) {
        setState({ loading: false, error: profileError.message, profile: null, employee: null })
        return
      }

      // fallback: если нет employee_id, попробуем по auth_user_id
      if (!profileData?.employee && profileData?.employee_id == null) {
        const { data: fallbackEmp } = await supabase
          .from('employees')
          .select(
            `
            id,
            first_name,
            last_name,
            middle_name,
            position_id,
            positions:position_id ( name )
          `,
          )
          .eq('auth_user_id', user.id)
          .maybeSingle()
        setState({ loading: false, error: '', profile: profileData, employee: fallbackEmp || null })
      } else {
        setState({ loading: false, error: '', profile: profileData, employee: profileData?.employee ?? null })
      }
    }
    fetchProfile()
    return () => {
      active = false
    }
  }, [supabase, user])

  return state
}
