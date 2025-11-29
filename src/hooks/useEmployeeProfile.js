import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'
import { useAuth } from './useAuth'

export function useEmployeeProfile() {
  const { user } = useAuth()
  const supabase = useSupabase()
  const [state, setState] = useState({ loading: true, error: '', profile: null })

  useEffect(() => {
    if (!user) {
      setState({ loading: false, error: '', profile: null })
      return
    }
    let active = true
    async function fetchProfile() {
      setState({ loading: true, error: '', profile: null })
      const { data, error } = await supabase
        .from('employees')
        .select(
          `
          id,
          first_name,
          last_name,
          middle_name,
          control_point,
          position_id,
          positions:position_id ( name )
        `,
        )
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        setState({ loading: false, error: error.message, profile: null })
      } else {
        setState({ loading: false, error: '', profile: data })
      }
    }
    fetchProfile()
    return () => {
      active = false
    }
  }, [supabase, user])

  return state
}
