import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Card, Btn, Table, Field, inputCls } from '../components/ui'
import { inr } from '../format'
import { api } from '../api'
import { useApp } from '../store'

const REPORTS = [
  { id: 'monthly', label: 'Monthly financial report' },
  { id: 'yearly', label: 'Annual financial report' },
  { id: 'transactions', label: 'All transactions' },
  { id: 'investments', label: 'Investment performance' },
  { id: 'accounts', label: 'Accounts (balances)' },
  { id: 'networth', label: 'Net worth (current)' }
] as const

interface YearRow { year: number; income: number; expenses: number; savings: number; savings_rate: number | null; investment_contributions: number; investment_withdrawn: number; investment_gain: number; year_end_net_worth: number }

export default function Reports() {
  const { memberFilter } = useApp()
  const [year, setYear] = useState(new Date().getFullYear())
  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i)
  const exportCsv = (report: string) => {
    const p = new URLSearchParams({ report })
    p.set('year', String(year))
    if (memberFilter !== '') p.set('member_id', String(memberFilter))
    window.open('/api/reports/export/csv?' + p.toString(), '_blank')
  }
  const exportExcel = () => window.open('/api/reports/export/excelWorkbook', '_blank')
  const backup = () => window.open('/api/reports/export/backup', '_blank')
  const printable = () => {
    const p = new URLSearchParams({ year: String(year) })
    if (memberFilter !== '') p.set('member_id', String(memberFilter))
    window.open('/api/reports/export/printable?' + p.toString(), '_blank')
  }

  return (
    <div className="space-y-4">
      <Card title="Export reports">
        <div className="flex gap-3 items-end flex-wrap">
          <Field label="Year">
            <select className={inputCls} value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <div className="flex gap-2 flex-wrap">
            {REPORTS.map(r => (
              <Btn key={r.id} tone="ghost" onClick={() => exportCsv(r.id)}>
                <span className="flex items-center gap-1"><Download size={13} /> {r.label}</span>
              </Btn>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex-wrap">
          <Btn onClick={exportExcel}><span className="flex items-center gap-1"><FileSpreadsheet size={14} /> Export everything to Excel</span></Btn>
          <Btn onClick={backup}><span className="flex items-center gap-1"><Download size={14} /> Full JSON backup</span></Btn>
          <Btn tone="ghost" onClick={printable}><span className="flex items-center gap-1"><Printer size={14} /> Printable / PDF (Year {year})</span></Btn>
        </div>
        <p className="text-xs text-slate-400 mt-2">PDF: the printable report opens in a new tab — press Ctrl+P / Cmd+P and choose “Save as PDF”. This keeps the app fully offline.</p>
      </Card>

      <YearlyTable memberFilter={memberFilter} />
    </div>
  )
}

function YearlyTable({ memberFilter }: { memberFilter: number | '' }) {
  const [rows, setRows] = useState<YearRow[] | null>(null)
  useEffect(() => {
    api.get<YearRow[]>('/reports/yearly-preview' + (memberFilter !== '' ? '?member_id=' + memberFilter : ''))
      .then(setRows).catch(() => {})
  }, [memberFilter])
  return (
    <Card title={`Year-by-year comparison`}>
      <Table head={['Year', 'Income', 'Expenses', 'Savings', 'Savings rate', 'Invested', 'Withdrawn', 'Investment gain', 'Year-end net worth']}>
        {(rows || []).map(r => (
          <tr key={r.year} className="border-b border-slate-100 dark:border-slate-700">
            <td className="py-2 px-2 font-medium">{r.year}</td>
            <td className="py-2 px-2 text-emerald-600">{inr(r.income, true)}</td>
            <td className="py-2 px-2 text-rose-600">{inr(r.expenses, true)}</td>
            <td className="py-2 px-2">{inr(r.savings, true)}</td>
            <td className="py-2 px-2">{r.savings_rate ?? '—'}</td>
            <td className="py-2 px-2">{inr(r.investment_contributions, true)}</td>
            <td className="py-2 px-2">{inr(r.investment_withdrawn, true)}</td>
            <td className="py-2 px-2">{inr(r.investment_gain, true)}</td>
            <td className="py-2 px-2 font-medium">{inr(r.year_end_net_worth, true)}</td>
          </tr>
        ))}
        {rows === null && <tr><td colSpan={9} className="py-4 text-center text-slate-400">Loading…</td></tr>}
        {rows !== null && rows.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-400">No data yet</td></tr>}
      </Table>
    </Card>
  )
}
