import { FormEvent, useState } from 'react'
import { api } from '../api'
import { useApp } from '../store'
import { Field, inputCls, Btn, Err } from './ui'

export default function LiabilityForm({ onDone }: { onDone: () => void }) {
  const { boot, refresh } = useApp()
  const [err, setErr] = useState<unknown>(null)
  const [f, setF] = useState<Record<string, string>>({
    name: '', lender: '', owner_id: '', original_amount: '', current_outstanding: '',
    interest_rate: '', emi: '', start_date: '', end_date: '', notes: ''
  })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const num = (v: string) => (v === '' ? null : Number(v))
      await api.post('/liabilities', {
        name: f.name, lender: f.lender, owner_id: f.owner_id || null,
        original_amount: Number(f.original_amount || 0),
        current_outstanding: Number(f.current_outstanding || f.original_amount || 0),
        interest_rate: num(f.interest_rate), emi: num(f.emi),
        start_date: f.start_date || null, end_date: f.end_date || null, notes: f.notes
      })
      refresh(); onDone()
    } catch (e2) { setErr(e2) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Loan name"><input required className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Lender"><input className={inputCls} value={f.lender} onChange={e => set('lender', e.target.value)} /></Field>
        <Field label="Owner">
          <select className={inputCls} value={f.owner_id} onChange={e => set('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Original amount (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.original_amount} onChange={e => set('original_amount', e.target.value)} /></Field>
        <Field label="Current outstanding (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.current_outstanding} onChange={e => set('current_outstanding', e.target.value)} /></Field>
        <Field label="Interest rate (%)"><input type="number" step="0.01" min="0" className={inputCls} value={f.interest_rate} onChange={e => set('interest_rate', e.target.value)} /></Field>
        <Field label="Monthly EMI (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.emi} onChange={e => set('emi', e.target.value)} /></Field>
        <Field label="Start date"><input type="date" className={inputCls} value={f.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
        <Field label="Expected end date"><input type="date" className={inputCls} value={f.end_date} onChange={e => set('end_date', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2"><Btn>Save liability</Btn></div>
    </form>
  )
}
