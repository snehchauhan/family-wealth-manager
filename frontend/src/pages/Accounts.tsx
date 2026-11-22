import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2, LineChart } from 'lucide-react'
import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { api, Account, Tx } from '../api'
import { useApp, confirmMsg } from '../store'
import { Card, Table, Btn, Modal, Field, inputCls, Err, StatCard } from '../components/ui'
import { inr, ddmmyyyy, monthLabel } from '../format'

const empty = { name: '', bank_name: '', owner_id: '', account_type: 'savings', opening_balance: '0', opening_date: '', notes: '' }

export default function Accounts() {
  const { boot, changed, refresh } = useApp()
  const [rows, setRows] = useState<Account[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [detail, setDetail] = useState<Account | null>(null)
  const [detailTx, setDetailTx] = useState<Tx[]>([])
  const [history, setHistory] = useState<{ month: string; balance: number }[]>([])
  const [err, setErr] = useState<unknown>(null)
  const [f, setF] = useState<typeof empty>(empty)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const load = () => api.get<Account[]>('/accounts?with_balance=true').then(setRows).catch(setErr)
  useEffect(() => { load() }, [changed])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const body = {
        name: f.name, bank_name: f.bank_name, account_type: f.account_type,
        owner_id: f.owner_id || null, opening_balance: Number(f.opening_balance || 0),
        opening_date: f.opening_date, notes: f.notes
      }
      if (editing) await api.put('/accounts/' + editing.id, body)
      else await api.post('/accounts', body)
      setAdding(false); setEditing(null); setF(empty); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const remove = async (a: Account) => {
    if (!confirmMsg(`Delete account "${a.name}"? Only possible if it has no transactions.`)) return
    try { await api.del('/accounts/' + a.id) } catch (e) { setErr(e); return }
    refresh(); load()
  }

  const openDetail = async (a: Account) => {
    setDetail(a)
    const [tx, hist] = await Promise.all([
      api.get<Tx[]>(`/accounts/${a.id}/transactions`),
      api.get (`/accounts/${a.id}/history`)
    ])
    setDetailTx(tx)
    setHistory((hist as { history: typeof history }).history || [])
  }

  const total = rows.reduce((s, r) => s + (r.current_balance || 0), 0)
  const editTarget = editing
  const form = (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account name"><input required className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Bank name (do not enter full account numbers)"><input className={inputCls} value={f.bank_name} onChange={e => set('bank_name', e.target.value)} /></Field>
        <Field label="Account type">
          <select className={inputCls} value={f.account_type} onChange={e => set('account_type', e.target.value)}>
            {(boot?.account_types || ['savings']).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select className={inputCls} value={f.owner_id} onChange={e => set('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Opening balance (₹)"><input type="number" step="0.01" className={inputCls} value={f.opening_balance} onChange={e => set('opening_balance', e.target.value)} /></Field>
        <Field label="Opening balance date"><input type="date" required className={inputCls} value={f.opening_date} onChange={e => set('opening_date', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2"><Btn>{editTarget ? 'Update' : 'Save account'}</Btn></div>
    </form>
  )

  return (
    <div className="space-y-4">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total bank & cash" value={inr(total, true)} tone="blue" />
        <StatCard label="Accounts" value={String(rows.length)} />
      </div>
      <Card>
        <div className="flex justify-end mb-3"><Btn onClick={() => { setF(empty); setAdding(true) }}>Add account</Btn></div>
        <Table head={['Account', 'Bank', 'Owner', 'Type', 'Opening balance', 'Current balance', '']}>
          {rows.map(a => (
            <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="py-2 px-2 font-medium cursor-pointer text-sky-600" onClick={() => openDetail(a)}>{a.name}</td>
              <td className="py-2 px-2">{a.bank_name || '—'}</td>
              <td className="py-2 px-2">{boot?.members.find(m => m.id === a.owner_id)?.name || '—'}</td>
              <td className="py-2 px-2 capitalize">{a.account_type.replace('_', ' ')}</td>
              <td className="py-2 px-2">{inr(a.opening_balance)}</td>
              <td className="py-2 px-2 font-medium">{inr(a.current_balance)}</td>
              <td className="py-2 px-2 text-right whitespace-nowrap">
                <button className="p-1 hover:text-sky-600" onClick={() => openDetail(a)} title="History"><LineChart size={15} /></button>
                <button className="p-1 hover:text-sky-600" onClick={() => { setEditing(a); setF({ name: a.name, bank_name: a.bank_name || '', owner_id: String(a.owner_id ?? ''), account_type: a.account_type, opening_balance: String(a.opening_balance), opening_date: a.opening_date, notes: a.notes || '' }); setAdding(true) }}><Pencil size={15} /></button>
                <button className="p-1 hover:text-rose-600" onClick={() => remove(a)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-400">No accounts yet. Add your first bank/cash account.</td></tr>}
        </Table>
      </Card>

      {adding && <Modal title={editTarget ? 'Edit account' : 'Add account'} onClose={() => { setAdding(false); setEditing(null) }}>{form}</Modal>}

      {detail && (
        <Modal title={`${detail.name} — details`} onClose={() => setDetail(null)} wide>
          <p className="text-sm text-slate-400 mb-3">Current balance: <b>{inr(rows.find(r => r.id === detail.id)?.current_balance)}</b> · Opening: {inr(detail.opening_balance)} on {ddmmyyyy(detail.opening_date)}</p>
          {history.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-1">Month-end balance history</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ReLineChart data={history.map(h => ({ ...h, label: monthLabel(Number(h.month.slice(0, 4)), Number(h.month.slice(5, 7))) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => inr(Number(v), true)} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Line dataKey="balance" name="Balance" stroke="#0ea5e9" dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          )}
          <h4 className="font-semibold mb-1">Account transactions</h4>
          <Table head={['Date', 'Type', 'Amount', 'Description', 'Category']}>
            {detailTx.map(t => (
              <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-1.5 px-2">{ddmmyyyy(t.date)}</td>
                <td className="py-1.5 px-2 capitalize">{t.type}</td>
                <td className="py-1.5 px-2">{inr(t.amount)}</td>
                <td className="py-1.5 px-2">{t.description || '—'}</td>
                <td className="py-1.5 px-2">{t.category_name || (t.type === 'transfer' ? '→ ' + (t.to_account_name || '') : '—')}</td>
              </tr>
            ))}
            {detailTx.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">No transactions yet</td></tr>}
          </Table>
        </Modal>
      )}
    </div>
  )
}
