import { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow p-4 ${className}`}>
      {title && <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">{title}</h3>}
      {children}
    </div>
  )
}

const TONES: Record<string, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-rose-600 dark:text-rose-400',
  blue: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  slate: 'text-slate-700 dark:text-slate-200'
}

export function StatCard({ label, value, tone = 'slate', sub }: { label: string; value: string; tone?: keyof typeof TONES; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xl font-bold mt-1 ${TONES[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-8">
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} mx-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
        </div>
        <div className="p-4 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = 'w-full mt-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500'

export function Btn({ children, onClick, tone = 'primary', disabled }: {
  children: ReactNode; onClick?: () => void; tone?: 'primary' | 'danger' | 'ghost'; disabled?: boolean
}) {
  const tones = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600'
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-3 py-1.5 rounded font-medium disabled:opacity-50 ${tones[tone]}`}>{children}</button>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-400 uppercase">
          {head.map(h => <th key={h} className="py-2 px-2 whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Err({ err }: { err: unknown }) {
  const msg = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message) : String(err)
  return <div className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded px-3 py-2 my-2">{msg}</div>
}
