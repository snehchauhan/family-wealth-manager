import { FormEvent, useEffect, useState } from 'react'
import { api, Bootstrap, Tx } from '../api'
import { useApp, confirmMsg } from '../store'
import { Field, inputCls, Btn, Err } from './ui'
import { today } from '../format'

export interface TxDefaults { type?: string; [k: string]: unknown }

export function useAccounts() {
  const { boot, changed } = useApp()
  const [accounts, setAccounts] = useState<{ id: number; name: string; account_type: string }[]>([])
  useEffect(() => {
    api.get<typeof accounts>('/accounts').then(setAccounts).catch(() => {})
  }, [changed, boot])
  return accounts
}

export default function TxForm({ defaults, onDone, tx }: {
  defaults?: TxDefaults; onDone: () => void; tx?: Tx | null
}) {
  const { boot, memberFilter, refresh } = useApp()
  const accounts = useAccounts()
  const [type, setType] = useState(tx?.type || defaults?.type as string || 'expense')
  const members = boot?.members || []
  const cats = (boot?.categories || []).filter(c => c.kind === (type === 'expense' ? 'expense' : 'income'))
  const [err, setErr] = useState<unknown>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [f, setF] = useState<Record<string, unknown>>({
    date: today(),
    amount: tx?.amount ?? (defaults?.amount as number ?? ''),
    member_id: tx?.member_id ?? (memberFilter === '' ? '' : memberFilter),
    account_id: tx?.account_id ?? '',
    to_account_id: tx?.to_account_id ?? '',
    category_id: tx?.category_id ?? '',
    subcategory: tx?.subcategory ?? '',
    payment_method: tx?.payment_method ?? 'upi',
    beneficiary: tx?.beneficiary ?? '',
    description: tx?.description ?? '',
    notes: tx?.notes ?? ''
  })
  const set = (k: string, v: unknown) => { setF(p => ({ ...p, [k]: v })); setDuplicate(false) }

  const submit = async (force = false) => {
    setErr(null)
    const body: Record<string, unknown> = {
      type, date: f.date, amount: Number(f.amount),
      member_id: f.member_id === '' ? null : f.member_id,
      account_id: f.account_id === '' ? null : f.account_id,
      to_account_id: type === 'transfer' ? (f.to_account_id === '' ? null : f.to_account_id) : null,
      category_id: type === 'transfer' ? null : (f.category_id === '' ? null : f.category_id),
      subcategory: f.subcategory, payment_method: type === 'transfer' ? null : f.payment_method,
      beneficiary: f.beneficiary, description: f.description, notes: f.notes
    }
    try {
      await api.post('/transactions' + (force ? '/force' : ''), body)
      refresh(); onDone()
    } catch (e) {
      if ((e as { existing_id?: number })?.existing_id) setDuplicate(true)
      setErr(e)
    }
  }

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    if (duplicate) { await submit(true); return }
    await submit(false)
  }

  const isTransfer = type === 'transfer'

  return (
    <form onSubmit={submitForm} className="space-y-3">
      {err ? <Err err={err} /> : null}
      {duplicate && (
        <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded px-3 py-2">
          A transaction with the same date, amount and account already exists. Save again to keep it anyway.
        </div>
      )}
      <div className="flex gap-2">
        {(['income', 'expense', 'transfer'] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`flex-1 py-1.5 rounded capitalize border ${type === t ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-600'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date (DD-MM-YYYY)">
          <input type="date" required className={inputCls} value={String(f.date)} onChange={e => set('date', e.target.value)} />
        </Field>
        <Field label="Amount (₹)">
          <input type="number" required min="0.01" step="0.01" className={inputCls} value={String(f.amount)} onChange={e => set('amount', e.target.value)} />
        </Field>
        <Field label="Person">
          <select className={inputCls} value={String(f.member_id)} onChange={e => set('member_id', e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">—</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label={isTransfer ? 'From account' : 'Account'}>
          <select required className={inputCls} value={String(f.account_id)} onChange={e => set('account_id', e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Select…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {isTransfer && (
          <Field label="To account">
            <select required className={inputCls} value={String(f.to_account_id)} onChange={e => set('to_account_id', e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Select…</option>
              {accounts.filter(a => a.id !== f.account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        {!isTransfer && (
          <Field label="Category">
            <select className={inputCls} value={String(f.category_id)} onChange={e => set('category_id', e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">—</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {!isTransfer && (
          <Field label="Subcategory (optional)">
            <input className={inputCls} value={String(f.subcategory)} onChange={e => set('subcategory', e.target.value)} />
          </Field>
        )}
        {!isTransfer && (
          <Field label="Payment method">
            <select className={inputCls} value={String(f.payment_method)} onChange={e => set('payment_method', e.target.value)}>
              {(boot?.payment_methods || []).map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </Field>
        )}
        {!isTransfer && (
          <Field label="Beneficiary (optional)">
            <input className={inputCls} value={String(f.beneficiary)} onChange={e => set('beneficiary', e.target.value)} />
          </Field>
        )}
        <Field label={isTransfer ? 'Reference / notes' : 'Description'}>
          <input className={inputCls} value={String(f.description)} onChange={e => set('description', e.target.value)} />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <input className={inputCls} value={String(f.notes)} onChange={e => set('notes', e.target.value)} />
      </Field>
      {isTransfer && (
        <p className="text-xs text-slate-400">Transfers are not counted as income or expense.</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Btn tone="ghost" onClick={onDone}>Cancel</Btn>
        <Btn>{duplicate ? 'Save anyway' : 'Save'}</Btn>
      </div>
    </form>
  )
}
