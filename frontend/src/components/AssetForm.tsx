import { FormEvent, useState } from 'react'
import { api } from '../api'
import { useApp } from '../store'
import { Field, inputCls, Btn, Err } from './ui'

export default function AssetForm({ onDone }: { onDone: () => void }) {
  const { boot, refresh } = useApp()
  const [err, setErr] = useState<unknown>(null)
  const [f, setF] = useState<Record<string, string>>({
    name: '', category: 'Property', owner_id: '', purchase_date: '', purchase_price: '',
    current_value: '', description: '', notes: ''
  })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const cats = ['Property', 'Land', 'Vehicle', 'Gold', 'Electronics', 'Other']

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/assets', {
        name: f.name, category: cats.includes(f.category) ? f.category : f.custom_category || f.category,
        owner_id: f.owner_id || null,
        purchase_date: f.purchase_date || null,
        purchase_price: Number(f.purchase_price || 0),
        current_value: f.current_value ? Number(f.current_value) : null,
        valuation_date: f.current_value ? new Date().toISOString().slice(0, 10) : null,
        description: f.description, notes: f.notes
      })
      refresh(); onDone()
    } catch (e2) { setErr(e2) }
  }

  const knownCat = cats.includes(f.category)
  return (
    <form onSubmit={submit} className="space-y-3">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Asset name"><input required className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Category">
          <select className={inputCls} value={knownCat ? f.category : '__custom'} onChange={e => set('category', e.target.value === '__custom' ? '' : e.target.value)}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom">Custom…</option>
          </select>
        </Field>
        {!knownCat && f.category === '' && (
          <Field label="Custom category"><input required className={inputCls} value={f.custom_category || ''} onChange={e => set('custom_category', e.target.value)} /></Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <select className={inputCls} value={f.owner_id} onChange={e => set('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Purchase date"><input type="date" className={inputCls} value={f.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></Field>
        <Field label="Purchase price (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></Field>
        <Field label="Estimated current value (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.current_value} onChange={e => set('current_value', e.target.value)} /></Field>
        <Field label="Description"><input className={inputCls} value={f.description} onChange={e => set('description', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2"><Btn>Save asset</Btn></div>
    </form>
  )
}
