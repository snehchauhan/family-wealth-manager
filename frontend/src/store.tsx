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
}

const AppCtx = createContext<Ctx>({
  boot: null, memberFilter: '', setMemberFilter: () => {},
  refresh: () => {}, dark: false, toggleDark: () => {}, changed: 0
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [memberFilter, setMemberFilter] = useState<number | ''>('')
  const [dark, setDark] = useState(false)
  const [changed, setChanged] = useState(0)

  const loadBoot = () => api.get<Bootstrap>('/meta/bootstrap').then(setBoot).catch(() => {})
  useEffect(() => { loadBoot() }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <AppCtx.Provider value={{
      boot, memberFilter, setMemberFilter,
      refresh: () => setChanged(c => c + 1),
      dark, toggleDark: () => setDark(d => !d), changed
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useApp = () => useContext(AppCtx)

export function confirmMsg(msg: string): boolean {
  return window.confirm(msg)
}
