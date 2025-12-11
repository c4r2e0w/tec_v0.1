/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

const SupabaseContext = createContext(null)

export function SupabaseProvider({ children }) {
  const value = useMemo(() => ({ supabase }), [])
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm shadow-xl">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Конфигурация</p>
          <p className="mt-2 text-base font-semibold text-white">
            Не заданы переменные VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
          </p>
          <p className="mt-2 text-slate-300">
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
