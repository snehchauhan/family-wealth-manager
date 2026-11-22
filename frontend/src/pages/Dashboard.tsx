import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts'
import { api, DashboardData, MonthSummary } from '../api'
import { useApp, YEAR_FALLBACK } from '../store'
import { Card, StatCard } from '../components/ui'
import { inr, pct, monthLabel } from '../format'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b']

export default function Dashboard() {
  const { memberFilter, changed, years } = useApp()
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number | ''>(now.getMonth() + 1)
  const [data, setData] = useState<DashboardData | null>(null)
  const [series, setSeries] = useState<MonthSummary[]>([])

  useEffect(() => {
    const p = new URLSearchParams({ year: String(year) })
    if (month !== '') p.set('month', String(month))
    if (memberFilter !== '') p.set('member_id', String(memberFilter))
    api.get<DashboardData>('/dashboard?' + p.toString()).then(setData).catch(() => {})
    api.get<{ series: MonthSummary[] }>('/dashboard/series?year=' + year + (memberFilter !== '' ? '&member_id=' + memberFilter : ''))
      .then(r => setSeries(r.series || [])).catch(() => {})
  }, [year, month, memberFilter, changed])

  if (!data) return <div className="text-slate-400">Loading dashboard…</div>
  const t = data.totals
  const mLabel = month === '' ? `Year ${year}` : monthLabel(year, month as number)
  const seriesMonths = series.map(s => ({ ...s, label: monthLabel(s.year, s.month) }))

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-400 block">Month</label>
          <select value={month} className="mt-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            onChange={e => setMonth(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Whole year</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{monthLabel(year, m)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block">Year</label>
          <select value={year} className="mt-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            onChange={e => setYear(Number(e.target.value))}>
            {Array.from(new Set([...(years.length ? years : YEAR_FALLBACK()), now.getFullYear()])).sort((a, b) => a - b).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="text-sm text-slate-400 self-end pb-2">{mLabel} · {data.period.from} → {data.period.to}</div>
        {t.has_estimates ? <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded self-end mb-1">Some values estimated at cost (no recorded valuation)</span> : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`Income ${mLabel}`} value={inr(t.income, true)} tone="green" />
        <StatCard label={`Expenses ${mLabel}`} value={inr(t.expenses, true)} tone="red" />
        <StatCard label="Savings" value={inr(t.savings, true)} tone="blue" sub={`Savings rate ${pct(t.savings_rate)}`} />
        <StatCard label="Net cash flow" value={inr(t.monthly_cash_flow, true)} tone={Number(t.monthly_cash_flow) >= 0 ? 'green' : 'red'} />
        <StatCard label="Investment contributions" value={inr(t.investment_contributions, true)} tone="blue" />
        <StatCard label="Current investment value" value={inr(t.investment_current_value, true)} tone="blue" sub={`Gain/loss ${inr(t.investment_gain, true)}`} />
        <StatCard label="Bank & cash" value={inr(t.bank_cash, true)} sub={`YTD income ${inr(t.ytd_income, true)}`} />
        <StatCard label="Net worth" value={inr(t.net_worth, true)} tone={Number(t.net_worth) >= 0 ? 'green' : 'red'}
          sub={`Assets ${inr(t.total_assets, true)} − Liabilities ${inr(t.total_liabilities, true)}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Monthly income vs expenses (all months of selected year)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={seriesMonths}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Monthly savings">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={seriesMonths}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Bar dataKey="savings" name="Savings" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Net worth over time">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={seriesMonths}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Area dataKey="month_end_net_worth" name="Net worth" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Expense category breakdown">
          {data.expense_by_category.length === 0 ? <div className="text-slate-400 py-8 text-center">No expenses in this period</div> :
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.expense_by_category} dataKey="amount" nameKey="name" outerRadius={90}>
                {data.expense_by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Asset allocation">
          {Object.keys(data.investment_by_type).length === 0 ? <div className="text-slate-400 py-8 text-center">No investment valuations yet</div> :
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={Object.entries(data.investment_by_type).map(([k, v]) => ({ name: k, value: v }))}
                dataKey="value" nameKey="name" outerRadius={90}>
                {Object.keys(data.investment_by_type).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>}
        </Card>
        <Card title="Net worth composition (bank vs investments vs assets)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={seriesMonths}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="net_worth_breakdown.bank_cash" name="Bank & cash" stroke="#0ea5e9" dot={false} />
              <Line dataKey="net_worth_breakdown.investments" name="Investments" stroke="#8b5cf6" dot={false} />
              <Line dataKey="net_worth_breakdown.assets" name="Assets" stroke="#10b981" dot={false} />
              <Line dataKey="net_worth_breakdown.liabilities" name="Liabilities" stroke="#ef4444" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
