import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'
import { api, MonthSummary } from '../api'
import { useApp } from '../store'
import { Card, StatCard, Table } from '../components/ui'
import { inr, monthLabel } from '../format'

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#ef4444']

interface Snapshot {
  date: string; bank_cash: number; investments: number; assets: number
  liabilities: number; net_worth: number; has_estimates: boolean
}

export default function NetWorth() {
  const { memberFilter } = useApp()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [timeline, setTimeline] = useState<MonthSummary[]>([])
  const [perf, setPerf] = useState<{ overall: Record<string, number>; by_investment: Record<string, unknown>[] } | null>(null)

  useEffect(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const p = memberFilter !== '' ? '&member_id=' + memberFilter : ''
    api.get<Snapshot>(`/dashboard/networth?on_date=${todayIso}` + p).then(setSnap).catch(() => {})
    api.get<{ series: MonthSummary[] }>('/dashboard/timeline' + p).then(r => setTimeline(r.series)).catch(() => {})
    api.get<typeof perf>('/dashboard/performance' + p).then(setPerf).catch(() => {})
  }, [memberFilter])

  if (!snap) return <div className="text-slate-400">Loading…</div>
  const tl = timeline.map(s => ({ ...s, label: monthLabel(s.year, s.month) }))
  const breakdown = [
    { name: 'Bank & cash', value: snap.bank_cash },
    { name: 'Investments', value: snap.investments },
    { name: 'Physical assets', value: snap.assets },
    { name: 'Liabilities', value: snap.liabilities }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Net worth (now)" value={inr(snap.net_worth, true)} tone={snap.net_worth >= 0 ? 'green' : 'red'} />
        <StatCard label="Bank & cash" value={inr(snap.bank_cash, true)} tone="blue" />
        <StatCard label="Investments" value={inr(snap.investments, true)} tone="blue" />
        <StatCard label="Physical assets" value={inr(snap.assets, true)} />
        <StatCard label="Liabilities" value={inr(snap.liabilities, true)} tone="red" />
      </div>
      {snap.has_estimates && (
        <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded px-3 py-2 text-sm">
          Some historical valuations are not recorded, so cost basis was used where no valuation exists. Add month-end valuations in Investments or via Reports for exact historical net worth.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Net worth over time (from first record)">
          {tl.length === 0 ? <div className="text-slate-400 py-8 text-center">No data yet</div> :
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tl}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="month_end_net_worth" name="Net worth" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Composition today">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={breakdown} dataKey="value" nameKey="name" outerRadius={95}>
                {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Month-end net worth history">
        <Table head={['Month', 'Income', 'Expenses', 'Savings', 'Bank', 'Investments', 'Assets', 'Liabilities', 'Net worth', 'Estimated?']}>
          {tl.slice().reverse().map(m => (
            <tr key={`${m.year}-${m.month}`} className="border-b border-slate-100 dark:border-slate-700">
              <td className="py-1.5 px-2 whitespace-nowrap">{m.label}</td>
              <td className="py-1.5 px-2">{inr(m.income, true)}</td>
              <td className="py-1.5 px-2">{inr(m.expenses, true)}</td>
              <td className="py-1.5 px-2">{inr(m.savings, true)}</td>
              <td className="py-1.5 px-2">{inr(m.net_worth_breakdown.bank_cash, true)}</td>
              <td className="py-1.5 px-2">{inr(m.net_worth_breakdown.investments, true)}</td>
              <td className="py-1.5 px-2">{inr(m.net_worth_breakdown.assets, true)}</td>
              <td className="py-1.5 px-2">{inr(m.net_worth_breakdown.liabilities, true)}</td>
              <td className="py-1.5 px-2 font-medium">{inr(m.month_end_net_worth, true)}</td>
              <td className="py-1.5 px-2">{m.net_worth_estimated ? <span className="text-amber-600 text-xs">partly estimated</span> : 'recorded'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
