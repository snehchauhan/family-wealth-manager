import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2, Download } from 'lucide-react'
import { api, Tx } from '../api'
import { useApp, confirmMsg } from '../store'
import { Card, Table, Btn, Modal, Field, inputCls, Err } from '../components/ui'
import TxForm from '../components/TxForm'
import { inr, ddmmyyyy } from '../format'

const BADGE: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  transfer: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
}

export default function Transactions() {
  const { boot, memberFilter, changed, refresh } = useApp()
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ total: number; items: Tx[] } | null>(null)
  const [editing, setEditing] = useState<Tx | null>(null)
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const PAGE = 50

  const load = () => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
    if (type) p.set('type', type)
    if (search) p.set('search', search)
    if (from) p.set('date_from', from)
    if (to) p.set('date_to', to)
    if (memberFilter !== '') p.set('member_id', String(memberFilter))
    api.get<{ total: number; items: Tx[] }>('/transactions?' + p.toString()).then(setData).catch(setErr)
  }
  useEffect(load, [type, search, from, to, page, memberFilter, changed])

  const remove = async (tx: Tx) => {
    if (!confirmMsg(`Delete this ${tx.type} of ${inr(tx.amount)} on ${ddmmyyyy(tx.date)}?`)) return
    try { await api.del('/transactions/' + tx.id) } catch (e) { setErr(e); return }
    refresh(); load()
  }

  const exportCsv = () => {
    const p = new URLSearchParams({ report: 'transactions' })
    if (type) p.set('report', 'transactions')
    if (from) p.set('date_from', from)
    if (to) p.set('date_to', to)
    if (memberFilter !== '') p.set('member_id', String(memberFilter))
    window.open('/api/reports/export/csv?' + p.toString(), '_blank')
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-3 items-end flex-wrap">
          <Field label="Type">
            <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>
          <Field label="From"><input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="Search">
            <input placeholder="description, notes…" className={inputCls} value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }} />
          </Field>
          <Btn onClick={() => setAdding(true)}>Add transaction</Btn>
          <Btn tone="ghost" onClick={exportCsv}><span className="flex items-center gap-1"><Download size={14} /> Export CSV</span></Btn>
        </div>
      </Card>

      {err ? <Err err={err} /> : null}
      <Card title={`Transactions (${data?.total ?? 0})`}>
        <Table head={['Date', 'Type', 'Amount', 'Person', 'Category', 'Account', 'Description', '']}>
          {(data?.items || []).map(t => (
            <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="py-2 px-2 whitespace-nowrap">{ddmmyyyy(t.date)}</td>
              <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-xs capitalize ${BADGE[t.type] || ''}`}>{t.type}</span></td>
              <td className={`py-2 px-2 whitespace-nowrap font-medium ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : ''}`}>{inr(t.amount)}</td>
              <td className="py-2 px-2">{t.member_name || '—'}</td>
              <td className="py-2 px-2">{t.category_name || (t.type === 'transfer' ? '→ ' + (t.to_account_name || '') : '—')}{t.subcategory ? ` / ${t.subcategory}` : ''}</td>
              <td className="py-2 px-2">{t.account_name || '—'}</td>
              <td className="py-2 px-2 max-w-[220px] truncate" title={t.description || ''}>{t.description || '—'}</td>
              <td className="py-2 px-2 whitespace-nowrap text-right">
                <button className="p-1 hover:text-sky-600" onClick={() => setEditing(t)}><Pencil size={15} /></button>
                <button className="p-1 hover:text-rose-600" onClick={() => remove(t)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </Table>
        <div className="flex justify-between items-center pt-3 text-xs text-slate-400">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <Btn tone="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Btn>
            <Btn tone="ghost" disabled={(page + 1) * PAGE >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Btn>
          </div>
        </div>
      </Card>

      {adding && <Modal title="Add transaction" onClose={() => setAdding(false)}><TxForm onDone={() => { setAdding(false) }} /></Modal>}
      {editing && <Modal title="Edit transaction" onClose={() => setEditing(null)}><TxForm tx={editing} onDone={() => setEditing(null)} /></Modal>}
    </div>
  )
}
