const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      const j = await res.json()
      detail = typeof j.detail === 'object' ? j.detail : j.detail || j
    } catch { /* keep statusText */ }
    throw detail
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}

export interface Bootstrap {
  members: { id: number; name: string; kind: string }[]
  categories: { id: number; kind: string; name: string; parent_id: number | null }[]
  investment_types: string[]
  account_types: string[]
  payment_methods: string[]
  investment_tx_types: string[]
}

export interface Tx {
  id: number; type: string; date: string; amount: number
  member_id: number | null; account_id: number | null; to_account_id: number | null
  category_id: number | null; subcategory: string | null; payment_method: string | null
  beneficiary: string | null; description: string | null; notes: string | null
  category_name?: string | null; account_name?: string | null
  to_account_name?: string | null; member_name?: string | null
}

export interface Investment {
  id: number; investment_type: string; name: string; owner_id: number | null
  institution: string | null; scheme_type: string | null; folio: string | null; symbol: string | null
  gold_type: string | null; quantity: number | null; unit_label: string | null
  principal: number | null; interest_rate: number | null; start_date: string | null
  maturity_date: string | null; compounding: string | null; maturity_amount: number | null
  fd_status: string | null; current_value: number | null; current_value_date: string | null
  notes: string | null; is_active: number
  performance?: Perf
}

export interface Perf {
  contributed: number; withdrawn: number; dividends: number; units_held: number | null
  net_invested: number; current_value: number | null; realized_gain: number
  unrealized_gain: number | null; total_gain: number; return_pct: number | null
  xirr: number | null; sufficient_data: boolean
}

export interface DashboardData {
  period: { from: string; to: string }
  totals: Record<string, number | null>
  expense_by_category: { name: string; amount: number }[]
  investment_by_type: Record<string, number>
}

export interface MonthSummary {
  year: number; month: number; income: number; expenses: number; savings: number
  savings_rate: number | null; net_cash_flow: number
  investment_contributions: number; investment_withdrawn: number
  month_end_net_worth: number; net_worth_estimated: boolean
  net_worth_breakdown: { bank_cash: number; investments: number; assets: number; liabilities: number }
}

export interface Asset { id: number; name: string; category: string; owner_id: number | null; owner_name?: string; purchase_date: string | null; purchase_price: number; current_value: number | null; valuation_date: string | null; description: string | null; notes: string | null }
export interface Liability { id: number; name: string; lender: string | null; owner_id: number | null; owner_name?: string; original_amount: number; current_outstanding: number; interest_rate: number | null; emi: number | null; start_date: string | null; end_date: string | null; notes: string | null }
export interface Account { id: number; name: string; bank_name: string | null; owner_id: number | null; account_type: string; opening_balance: number; opening_date: string; notes: string | null; is_active: number; current_balance?: number }
