import { useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, TrendingUp, Home,
  Scale, FileBarChart, Settings, Plus, Moon, Sun
} from 'lucide-react'
import { AppProvider, useApp } from './store'
import QuickAdd from './components/QuickAdd'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Investments from './pages/Investments'
import AssetsLiabilities from './pages/AssetsLiabilities'
import NetWorth from './pages/NetWorth'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'assets', label: 'Assets & Liabilities', icon: Home },
  { id: 'networth', label: 'Net Worth', icon: Scale },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const

function Shell() {
  const [page, setPage] = useState<string>('dashboard')
  const [quickAdd, setQuickAdd] = useState<string | null>(null)
  const { boot, memberFilter, setMemberFilter, dark, toggleDark } = useApp()

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    transactions: <Transactions />,
    accounts: <Accounts />,
    investments: <Investments />,
    assets: <AssetsLiabilities />,
    networth: <NetWorth />,
    reports: <Reports />,
    settings: <SettingsPage />
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-52 bg-white dark:bg-slate-800 shadow flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="font-bold text-sky-600">Family Wealth</div>
          <div className="text-xs text-slate-400">Manager</div>
        </div>
        <nav className="flex-1 py-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${page === id ? 'bg-sky-50 dark:bg-slate-700 text-sky-600 border-r-2 border-sky-600' : ''}`}>
              <Icon size={16} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 text-xs text-slate-400">v1.0 · Local-first · INR</div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 shadow sticky top-0 z-10">
          <select value={memberFilter} onChange={e => setMemberFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5">
            <option value="">All family members</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={toggleDark} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setQuickAdd('transaction')}
            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded font-medium">
            <Plus size={16} /> Quick Add
          </button>
        </header>

        <main className="p-4 max-w-[1200px] mx-auto">{pages[page]}</main>
      </div>

      {quickAdd && <QuickAdd defaultType={quickAdd} onClose={() => setQuickAdd(null)} />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
