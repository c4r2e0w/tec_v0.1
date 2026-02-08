/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

const SupabaseContext = createContext(null)

export function SupabaseProvider({ children }) {
  const value = useMemo(() => ({ supabase }), [])
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-dark">
        <div className="max-w-md rounded-2xl border border-border bg-white p-6 text-sm shadow-xl">
          <p className="text-xs uppercase tracking-[0.25em] text-grayText">Конфигурация</p>
          <p className="mt-2 text-base font-semibold text-dark">
            Не заданы переменные VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
          </p>
          <p className="mt-2 text-grayText">
            Создайте файл <code>.env.local</code> в корне и пропишите ключи (смотри .env.example), затем перезапустите
            <code> npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }
  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useSupabase must be used within SupabaseProvider')
  return ctx.supabase
}
