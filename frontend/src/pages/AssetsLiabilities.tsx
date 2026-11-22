import { FormEvent, useEffect, useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { api, Asset, Liability } from '../api'
import { useApp, confirmMsg } from '../store'
import { Card, Table, Btn, Modal, Field, inputCls, Err, StatCard } from '../components/ui'
import AssetForm from '../components/AssetForm'
import LiabilityForm from '../components/LiabilityForm'
import { inr, ddmmyyyy, today } from '../format'

export default function AssetsLiabilities() {
  const { boot, memberFilter, changed, refresh } = useApp()
  const [assets, setAssets] = useState<{ items: Asset[]; totals: { purchase: number; current: number; change: number } } | null>(null)
  const [liabs, setLiabs] = useState<{ items: Liability[]; totals: { outstanding: number; emi: number; original: number } } | null>(null)
  const [adding, setAdding] = useState<'asset' | 'liability' | null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingLiab, setEditingLiab] = useState<Liability | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [af, setAf] = useState<Record<string, string>>({ name: '', category: 'Property', owner_id: '', purchase_date: '', purchase_price: '', current_value: '', description: '', notes: '', custom_category: '' })
  const [lf, setLf] = useState<Record<string, string>>({ name: '', lender: '', owner_id: '', original_amount: '', current_outstanding: '', interest_rate: '', emi: '', start_date: '', end_date: '', notes: '' })
  const setA = (k: string, v: string) => setAf(p => ({ ...p, [k]: v }))
  const setL = (k: string, v: string) => setLf(p => ({ ...p, [k]: v }))
  const cats = ['Property', 'Land', 'Vehicle', 'Gold', 'Electronics', 'Other']

  const load = () => {
    const q = memberFilter !== '' ? '?owner_id=' + memberFilter : ''
    api.get<typeof assets>('/assets' + q).then(setAssets).catch(setErr)
    api.get<typeof liabs>('/liabilities' + q).then(setLiabs).catch(setErr)
  }
  useEffect(load, [memberFilter, changed])

  const saveAsset = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const cat = (af as Record<string, string>).custom_category || (cats.includes(af.category) ? af.category : af.category)
      await api.post('/assets', {
        name: af.name, category: cat, owner_id: af.owner_id || null,
        purchase_date: af.purchase_date || null, purchase_price: Number(af.purchase_price || 0),
        current_value: af.current_value ? Number(af.current_value) : null,
        valuation_date: af.current_value ? today() : null, description: af.description, notes: af.notes
      })
      setAdding(null); setAf({ name: '', category: 'Property', owner_id: '', purchase_date: '', purchase_price: '', current_value: '', description: '', notes: '', custom_category: '' }); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const saveLiab = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const num = (v: string) => (v === '' ? null : Number(v))
      await api.post('/liabilities', {
        name: lf.name, lender: lf.lender, owner_id: lf.owner_id || null,
        original_amount: Number(lf.original_amount || 0),
        current_outstanding: Number(lf.current_outstanding || lf.original_amount || 0),
        interest_rate: num(lf.interest_rate), emi: num(lf.emi),
        start_date: lf.start_date || null, end_date: lf.end_date || null, notes: lf.notes
      })
      setAdding(null); setLf({ name: '', lender: '', owner_id: '', original_amount: '', current_outstanding: '', interest_rate: '', emi: '', start_date: '', end_date: '', notes: '' }); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const updAsset = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.put('/assets/' + editingAsset!.id, {
        name: af.name, category: af.category, owner_id: af.owner_id || null,
        purchase_date: af.purchase_date || null, purchase_price: Number(af.purchase_price || 0),
        current_value: af.current_value ? Number(af.current_value) : null,
        description: af.description, notes: af.notes
      })
      setEditingAsset(null); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const updLiab = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const num = (v: string) => (v === '' ? null : Number(v))
      await api.put('/liabilities/' + editingLiab!.id, {
        name: lf.name, lender: lf.lender, owner_id: lf.owner_id || null,
        original_amount: Number(lf.original_amount || 0), current_outstanding: Number(lf.current_outstanding || 0),
        interest_rate: num(lf.interest_rate), emi: num(lf.emi),
        start_date: lf.start_date || null, end_date: lf.end_date || null, notes: lf.notes
      })
      setEditingLiab(null); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const delAsset = async (a: Asset) => {
    if (!confirmMsg(`Delete asset "${a.name}"?`)) return
    try { await api.del('/assets/' + a.id) } catch (e) { setErr(e); return }
    refresh(); load()
  }
  const delLiab = async (l: Liability) => {
    if (!confirmMsg(`Delete liability "${l.name}"?`)) return
    try { await api.del('/liabilities/' + l.id) } catch (e) { setErr(e); return }
    refresh(); load()
  }

  const knownCat = cats.includes(af.category)
  const assetForm = (
    <form onSubmit={editingAsset ? updAsset : saveAsset} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Asset name"><input required className={inputCls} value={af.name} onChange={e => setA('name', e.target.value)} /></Field>
        <Field label="Category">
          <select className={inputCls} value={knownCat ? af.category : '__custom'} onChange={e => setA('category', e.target.value === '__custom' ? '' : e.target.value)}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom">Custom…</option>
          </select>
        </Field>
        {!knownCat && af.category === '' && <Field label="Custom category"><input required className={inputCls} value={af.custom_category} onChange={e => setA('custom_category', e.target.value)} /></Field>}
        <Field label="Owner">
          <select className={inputCls} value={af.owner_id} onChange={e => setA('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Purchase date"><input type="date" className={inputCls} value={af.purchase_date} onChange={e => setA('purchase_date', e.target.value)} /></Field>
        <Field label="Purchase price (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={af.purchase_price} onChange={e => setA('purchase_price', e.target.value)} /></Field>
        <Field label="Estimated current value (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={af.current_value} onChange={e => setA('current_value', e.target.value)} /></Field>
        <Field label="Description"><input className={inputCls} value={af.description} onChange={e => setA('description', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={af.notes} onChange={e => setA('notes', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end"><Btn>Save asset</Btn></div>
    </form>
  )

  const liabForm = (
    <form onSubmit={editingLiab ? updLiab : saveLiab} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Loan name"><input required className={inputCls} value={lf.name} onChange={e => setL('name', e.target.value)} /></Field>
        <Field label="Lender"><input className={inputCls} value={lf.lender} onChange={e => setL('lender', e.target.value)} /></Field>
        <Field label="Owner">
          <select className={inputCls} value={lf.owner_id} onChange={e => setL('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Original amount (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={lf.original_amount} onChange={e => setL('original_amount', e.target.value)} /></Field>
        <Field label="Current outstanding (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={lf.current_outstanding} onChange={e => setL('current_outstanding', e.target.value)} /></Field>
        <Field label="Interest rate (%)"><input type="number" step="0.01" min="0" className={inputCls} value={lf.interest_rate} onChange={e => setL('interest_rate', e.target.value)} /></Field>
        <Field label="Monthly EMI (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={lf.emi} onChange={e => setL('emi', e.target.value)} /></Field>
        <Field label="Start date"><input type="date" className={inputCls} value={lf.start_date} onChange={e => setL('start_date', e.target.value)} /></Field>
        <Field label="Expected end date"><input type="date" className={inputCls} value={lf.end_date} onChange={e => setL('end_date', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={lf.notes} onChange={e => setL('notes', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end"><Btn>Save liability</Btn></div>
    </form>
  )

  return (
    <div className="space-y-4">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total assets (current est.)" value={inr(assets?.totals.current, true)} tone="green" />
        <StatCard label="Total assets (purchase)" value={inr(assets?.totals.purchase, true)} />
        <StatCard label="Appreciation / depreciation" value={inr(assets?.totals.change, true)} tone={Number(assets?.totals.change) >= 0 ? 'green' : 'red'} />
        <StatCard label="Total liabilities outstanding" value={inr(liabs?.totals.outstanding, true)} tone="red" sub={`Monthly EMI ${inr(liabs?.totals.emi, true)}`} />
      </div>

      <Card>
        <div className="flex gap-2 mb-3">
          <Btn onClick={() => setAdding('asset')}>Add asset</Btn>
          <Btn onClick={() => setAdding('liability')}>Add liability</Btn>
        </div>
      </Card>

      <Card title="Assets">
        <Table head={['Name', 'Category', 'Owner', 'Purchased', 'Purchase price', 'Current value', 'Change', '']}>
          {(assets?.items || []).map(a => (
            <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700">
              <td className="py-2 px-2 font-medium">{a.name}</td>
              <td className="py-2 px-2">{a.category}</td>
              <td className="py-2 px-2">{a.owner_name || '—'}</td>
              <td className="py-2 px-2">{ddmmyyyy(a.purchase_date)}</td>
              <td className="py-2 px-2">{inr(a.purchase_price)}</td>
              <td className="py-2 px-2">{inr(a.current_value ?? a.purchase_price)}</td>
              <td className={`py-2 px-2 ${(a.current_value ?? a.purchase_price) - a.purchase_price >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {inr((a.current_value ?? a.purchase_price) - a.purchase_price)}
              </td>
              <td className="py-2 px-2 text-right whitespace-nowrap">
                <button className="p-1 hover:text-sky-600" onClick={() => { setEditingAsset(a); setAf({
                  name: a.name, category: cats.includes(a.category) ? a.category : '', custom_category: a.category,
                  owner_id: String(a.owner_id ?? ''), purchase_date: a.purchase_date || '',
                  purchase_price: String(a.purchase_price), current_value: a.current_value == null ? '' : String(a.current_value),
                  description: a.description || '', notes: a.notes || '' }) }}><Pencil size={15} /></button>
                <button className="p-1 hover:text-rose-600" onClick={() => delAsset(a)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
          {(assets?.items || []).length === 0 && <tr><td colSpan={8} className="py-4 text-center text-slate-400">No assets yet</td></tr>}
        </Table>
      </Card>

      <Card title="Liabilities">
        <Table head={['Name', 'Lender', 'Owner', 'Original', 'Outstanding', 'Rate %', 'EMI', 'End date', '']}>
          {(liabs?.items || []).map(l => (
            <tr key={l.id} className="border-b border-slate-100 dark:border-slate-700">
              <td className="py-2 px-2 font-medium">{l.name}</td>
              <td className="py-2 px-2">{l.lender || '—'}</td>
              <td className="py-2 px-2">{l.owner_name || '—'}</td>
              <td className="py-2 px-2">{inr(l.original_amount)}</td>
              <td className="py-2 px-2 text-rose-600">{inr(l.current_outstanding)}</td>
              <td className="py-2 px-2">{l.interest_rate ?? '—'}</td>
              <td className="py-2 px-2">{inr(l.emi)}</td>
              <td className="py-2 px-2">{ddmmyyyy(l.end_date)}</td>
              <td className="py-2 px-2 text-right whitespace-nowrap">
                <button className="p-1 hover:text-sky-600" onClick={() => { setEditingLiab(l); setLf({
                  name: l.name, lender: l.lender || '', owner_id: String(l.owner_id ?? ''),
                  original_amount: String(l.original_amount), current_outstanding: String(l.current_outstanding),
                  interest_rate: l.interest_rate == null ? '' : String(l.interest_rate), emi: l.emi == null ? '' : String(l.emi),
                  start_date: l.start_date || '', end_date: l.end_date || '', notes: l.notes || '' }) }}><Pencil size={15} /></button>
                <button className="p-1 hover:text-rose-600" onClick={() => delLiab(l)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
          {(liabs?.items || []).length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-400">No liabilities yet</td></tr>}
        </Table>
      </Card>

      {adding === 'asset' && <Modal title="Add asset" onClose={() => setAdding(null)}>{assetForm}</Modal>}
      {adding === 'liability' && <Modal title="Add liability" onClose={() => setAdding(null)}>{liabForm}</Modal>}
      {editingAsset && <Modal title="Edit asset" onClose={() => setEditingAsset(null)}>{assetForm}</Modal>}
      {editingLiab && <Modal title="Edit liability" onClose={() => setEditingLiab(null)}>{liabForm}</Modal>}
    </div>
  )
}
