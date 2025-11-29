import { useEffect, useState } from 'react'
import { useSupabase } from '../context/SupabaseProvider'

export function useAuth() {
  const supabase = useSupabase()
  if (!supabase) return { session: null, user: null, loading: false }
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return { session, user: session?.user ?? null, loading }
}
