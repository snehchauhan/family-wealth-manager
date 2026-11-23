import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, Bootstrap } from './api'

interface Ctx {
  boot: Bootstrap | null
  memberFilter: number | ''
  setMemberFilter: (v: number | '') => void
  refresh: () => void
  dark: boolean
  toggleDark: () => void
  changed: number
  years: number[]
}

const AppCtx = createContext<Ctx>({
  boot: null, memberFilter: '', setMemberFilter: () => {},
  refresh: () => {}, dark: false, toggleDark: () => {}, changed: 0,
  years: []
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [memberFilter, setMemberFilter] = useState<number | ''>('')
  const [dark, setDark] = useState(false)
  const [changed, setChanged] = useState(0)
  const [years, setYears] = useState<number[]>([])

  const loadBoot = () => api.get<Bootstrap>('/meta/bootstrap').then(setBoot).catch(() => {})
  useEffect(() => { loadBoot() }, [])
  useEffect(() => {
    api.get<{ years: number[] }>('/meta/years').then(r => setYears(r.years || [])).catch(() => {})
  }, [changed])

  useEffect(() => {
    const bump = () => setChanged(c => c + 1)
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') bump()
    })
    return () => window.removeEventListener('focus', bump)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <AppCtx.Provider value={{
      boot, memberFilter, setMemberFilter,
      refresh: () => setChanged(c => c + 1),
      dark, toggleDark: () => setDark(d => !d), changed,
      years
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export const YEAR_FALLBACK = () => {
  const y = new Date().getFullYear()
  return Array.from({ length: 10 }, (_, i) => y - 4 + i)
}

export const useApp = () => useContext(AppCtx)

export function confirmMsg(msg: string): boolean {
  return window.confirm(msg)
}
