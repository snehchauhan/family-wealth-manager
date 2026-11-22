import { FormEvent, useEffect, useState } from 'react'
import { api, Investment } from '../api'
import { useApp } from '../store'
import { Field, inputCls, Btn, Err } from './ui'
import { today } from '../format'
import { useAccounts } from './TxForm'

export default function InvTxForm({ onDone, investmentId, investments }: {
  onDone: () => void; investmentId?: number; investments?: Investment[]
}) {
  const { refresh } = useApp()
  const accounts = useAccounts()
  const [list, setList] = useState<Investment[]>(investments || [])
  const [err, setErr] = useState<unknown>(null)
  const [f, setF] = useState<Record<string, string>>({
    investment_id: investmentId ? String(investmentId) : '', date: today(), tx_type: 'purchase',
    amount: '', units: '', nav: '', account_id: '', description: '', notes: ''
  })
  useEffect(() => { if (!investments) api.get<Investment[]>('/investments').then(setList).catch(() => {}) }, [investments])
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const num = (v: string) => (v === '' ? null : Number(v))
    try {
      await api.post('/investments/transactions', {
        investment_id: Number(f.investment_id), date: f.date, tx_type: f.tx_type,
        amount: Number(f.amount), units: num(f.units), nav: num(f.nav),
        account_id: f.account_id || null, description: f.description, notes: f.notes
      })
      refresh(); onDone()
    } catch (e2) { setErr(e2) }
  }

  const isRedemption = f.tx_type === 'redemption' || f.tx_type === 'switch_out'
  return (
    <form onSubmit={submit} className="space-y-3">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Investment">
          <select required disabled={!!investmentId} className={inputCls} value={f.investment_id} onChange={e => set('investment_id', e.target.value)}>
            <option value="">Select…</option>
            {list.map(i => <option key={i.id} value={i.id}>{i.name} ({i.investment_type})</option>)}
          </select>
        </Field>
        <Field label="Transaction type">
          <select className={inputCls} value={f.tx_type} onChange={e => set('tx_type', e.target.value)}>
            {['purchase', 'redemption', 'dividend', 'switch_in', 'switch_out'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Date (DD-MM-YYYY)"><input type="date" required className={inputCls} value={f.date} onChange={e => set('date', e.target.value)} /></Field>
        <Field label={isRedemption ? 'Amount received (₹)' : 'Amount invested (₹)'}><input type="number" required step="0.01" min="0.01" className={inputCls} value={f.amount} onChange={e => set('amount', e.target.value)} /></Field>
        <Field label="Units / quantity (optional)"><input type="number" step="any" className={inputCls} value={f.units} onChange={e => set('units', e.target.value)} /></Field>
        <Field label="NAV / price per unit (optional)"><input type="number" step="any" className={inputCls} value={f.nav} onChange={e => set('nav', e.target.value)} /></Field>
        <Field label="Linked account (optional)">
          <select className={inputCls} value={f.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">—</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <p className="text-xs text-slate-400">Dividends are counted as realized gains, not income.</p>
      <div className="flex justify-end gap-2"><Btn>Save transaction</Btn></div>
    </form>
  )
}
