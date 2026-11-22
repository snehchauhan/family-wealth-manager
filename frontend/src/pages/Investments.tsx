import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { api, Investment, Perf } from '../api'
import { useApp, confirmMsg } from '../store'
import { Card, Table, Btn, Modal, Field, inputCls, Err, StatCard } from '../components/ui'
import InvTxForm from '../components/InvTxForm'
import { inr, pct, ddmmyyyy, today } from '../format'

const empty = {
  investment_type: 'mutual_fund', name: '', owner_id: '', institution: '', scheme_type: '',
  folio: '', symbol: '', gold_type: '', unit_label: 'units', principal: '', interest_rate: '',
  start_date: '', maturity_date: '', compounding: 'quarterly', maturity_amount: '',
  fd_status: 'active', current_value: '', current_value_date: '', notes: ''
}

export default function Investments() {
  const { boot, memberFilter, changed, refresh } = useApp()
  const [rows, setRows] = useState<Investment[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [detail, setDetail] = useState<Investment | null>(null)
  const [detailTx, setDetailTx] = useState<Record<string, unknown>[]>([])
  const [showSips, setShowSips] = useState(false)
  const [sips, setSips] = useState<Record<string, unknown>[]>([])
  const [overallPerf, setOverallPerf] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [f, setF] = useState<typeof empty>(empty)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const load = () => {
    const p = new URLSearchParams()
    if (typeFilter) p.set('investment_type', typeFilter)
    if (memberFilter !== '') p.set('owner_id', String(memberFilter))
    api.get<Investment[]>('/investments?' + p.toString()).then(setRows).catch(setErr)
    api.get<{ overall: Record<string, unknown> }>('/dashboard/performance' + (memberFilter !== '' ? '?member_id=' + memberFilter : ''))
      .then(r => setOverallPerf(r.overall)).catch(() => {})
    api.get<Record<string, unknown>[]>('/investments/sip/plans').then(setSips).catch(() => {})
  }
  useEffect(load, [typeFilter, memberFilter, changed])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const num = (v: string) => (v === '' ? null : Number(v))
    const body: Record<string, unknown> = {
      investment_type: f.investment_type, name: f.name, owner_id: f.owner_id || null,
      institution: f.institution || null, scheme_type: f.scheme_type || null,
      folio: f.folio || null, symbol: f.symbol || null, gold_type: f.gold_type || null,
      unit_label: f.unit_label || 'units', principal: num(f.principal), interest_rate: num(f.interest_rate),
      start_date: f.start_date || null, maturity_date: f.maturity_date || null,
      compounding: f.compounding, maturity_amount: num(f.maturity_amount), fd_status: f.fd_status,
      current_value: num(f.current_value), current_value_date: f.current_value ? today() : null, notes: f.notes
    }
    try {
      if (editing) await api.put('/investments/' + editing.id, body)
      else await api.post('/investments', body)
      setAdding(false); setEditing(null); setF(empty); refresh(); load()
    } catch (e2) { setErr(e2) }
  }

  const updateValuation = async (inv: Investment) => {
    const v = prompt(`Current value of "${inv.name}" (₹)?`)
    if (!v) return
    try {
      await api.put('/investments/' + inv.id, { current_value: Number(v), current_value_date: today() })
      refresh(); load()
    } catch (e) { setErr(e) }
  }

  const remove = async (inv: Investment) => {
    if (!confirmMsg(`Delete investment "${inv.name}"? Its transaction history will be deleted too.`)) return
    try { await api.del('/investments/' + inv.id) } catch (e) { setErr(e) }
    refresh(); load()
  }

  const openDetail = async (inv: Investment) => {
    setDetail(inv)
    setDetailTx(await api.get(`/investments/${inv.id}/transactions`))
  }

  const editForm = (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Investment type">
          <select className={inputCls} value={f.investment_type} onChange={e => set('investment_type', e.target.value)}>
            {(boot?.investment_types || []).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Name"><input required className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bluechip Direct Growth" /></Field>
        <Field label="Owner">
          <select className={inputCls} value={f.owner_id} onChange={e => set('owner_id', e.target.value)}>
            <option value="">—</option>
            {(boot?.members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Institution / AMC / Bank"><input className={inputCls} value={f.institution} onChange={e => set('institution', e.target.value)} /></Field>
        {f.investment_type === 'mutual_fund' && (
          <>
            <Field label="Scheme type"><input className={inputCls} value={f.scheme_type} onChange={e => set('scheme_type', e.target.value)} placeholder="equity / debt / hybrid" /></Field>
            <Field label="Folio (optional)"><input className={inputCls} value={f.folio} onChange={e => set('folio', e.target.value)} /></Field>
          </>
        )}
        {f.investment_type === 'stocks' && (
          <Field label="Stock symbol (optional)"><input className={inputCls} value={f.symbol} onChange={e => set('symbol', e.target.value)} /></Field>
        )}
        {f.investment_type === 'gold' && (
          <>
            <Field label="Gold type"><input className={inputCls} value={f.gold_type} onChange={e => set('gold_type', e.target.value)} placeholder="jewellery / coin / bar" /></Field>
            <Field label="Weight & unit"><input className={inputCls} value={f.unit_label} onChange={e => set('unit_label', e.target.value)} placeholder="grams" /></Field>
          </>
        )}
        {f.investment_type === 'fd' && (
          <>
            <Field label="Principal (₹)"><input type="number" step="0.01" className={inputCls} value={f.principal} onChange={e => set('principal', e.target.value)} /></Field>
            <Field label="Interest rate (%)"><input type="number" step="0.01" className={inputCls} value={f.interest_rate} onChange={e => set('interest_rate', e.target.value)} /></Field>
            <Field label="Start date"><input type="date" className={inputCls} value={f.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
            <Field label="Maturity date"><input type="date" className={inputCls} value={f.maturity_date} onChange={e => set('maturity_date', e.target.value)} /></Field>
            <Field label="Compounding">
              <select className={inputCls} value={f.compounding} onChange={e => set('compounding', e.target.value)}>
                {['monthly', 'quarterly', 'half_yearly', 'yearly'].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={f.fd_status} onChange={e => set('fd_status', e.target.value)}>
                {['active', 'matured', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Estimated current value (₹)"><input type="number" step="0.01" min="0" className={inputCls} value={f.current_value} onChange={e => set('current_value', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <p className="text-xs text-slate-400">Record purchases/redemptions as investment transactions. Current value updates the market valuation you enter manually.</p>
      <div className="flex justify-end gap-2"><Btn>{editing ? 'Update' : 'Save investment'}</Btn></div>
    </form>
  )

  return (
    <div className="space-y-4">
      {err ? <Err err={err} /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Current portfolio value" value={inr(overallPerf?.current_value as number, true)} tone="blue" />
        <StatCard label="Total contributed" value={inr(overallPerf?.contributed as number, true)} />
        <StatCard label="Total withdrawn" value={inr(overallPerf?.withdrawn as number, true)} />
        <StatCard label="Total profit / loss" value={inr(overallPerf?.total_gain as number, true)} tone={Number(overallPerf?.total_gain) >= 0 ? 'green' : 'red'}
          sub={`Return ${pct(overallPerf?.return_pct as number | null)}`} />
      </div>

      <Card>
        <div className="flex gap-3 items-end flex-wrap mb-3">
          <Field label="Type">
            <select className={inputCls} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {(boot?.investment_types || []).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Btn onClick={() => { setF(empty); setAdding(true) }}>Add investment</Btn>
          <Btn tone="ghost" onClick={() => setShowSips(s => !s)}>SIP tracker ({sips.length})</Btn>
        </div>
        <Table head={['Name', 'Type', 'Owner', 'Contributed', 'Withdrawn', 'Current value', 'Gain', 'Return %', 'XIRR', '']}>
          {rows.map(inv => {
            const pf = inv.performance
            return (
              <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="py-2 px-2 font-medium cursor-pointer text-sky-600 max-w-[200px] truncate" onClick={() => openDetail(inv)}>{inv.name}</td>
                <td className="py-2 px-2 capitalize">{inv.investment_type.replace('_', ' ')}</td>
                <td className="py-2 px-2">{boot?.members.find(m => m.id === inv.owner_id)?.name || '—'}</td>
                <td className="py-2 px-2">{inr(pf?.contributed)}</td>
                <td className="py-2 px-2">{inr(pf?.withdrawn)}</td>
                <td className="py-2 px-2 cursor-pointer" title="Click to update valuation" onClick={() => updateValuation(inv)}>
                  {pf?.current_value != null ? inr(pf.current_value) : <span className="text-slate-400">set value</span>}
                </td>
                <td className={`py-2 px-2 ${(pf?.total_gain ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(pf?.total_gain)}</td>
                <td className="py-2 px-2">{pf?.return_pct != null ? pct(pf.return_pct) : '—'}</td>
                <td className="py-2 px-2">{pf?.xirr != null ? (pf.xirr * 100).toFixed(1) + '%' : '—'}</td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  {inv.investment_type === 'fd' && inv.maturity_date && (
                    <span className="text-xs text-amber-600 mr-2">matures {ddmmyyyy(inv.maturity_date)}</span>
                  )}
                  <button className="p-1 hover:text-sky-600" onClick={() => { setEditing(inv); setF({
                    ...empty,
                    investment_type: inv.investment_type, name: inv.name, owner_id: String(inv.owner_id ?? ''),
                    institution: inv.institution || '', scheme_type: inv.scheme_type || '', folio: inv.folio || '',
                    symbol: inv.symbol || '', gold_type: inv.gold_type || '', unit_label: inv.unit_label || 'units',
                    principal: String(inv.principal ?? ''), interest_rate: String(inv.interest_rate ?? ''),
                    start_date: inv.start_date || '', maturity_date: inv.maturity_date || '',
                    compounding: inv.compounding || 'quarterly', maturity_amount: String(inv.maturity_amount ?? ''),
                    fd_status: inv.fd_status || 'active', current_value: String(inv.current_value ?? ''), notes: inv.notes || ''
                  }); setAdding(true) }}><Pencil size={15} /></button>
                  <button className="p-1 hover:text-rose-600" onClick={() => remove(inv)}><Trash2 size={15} /></button>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-slate-400">No investments yet</td></tr>}
        </Table>
      </Card>

      {showSips && (
        <Card title="SIP tracker — planned vs actually recorded installments">
          <Table head={['Fund', 'Monthly amount', 'Started', 'Status', 'Recorded installments', 'Total contributed', '']}>
            {sips.map((s: Record<string, unknown>) => (
              <tr key={String(s.id)} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-2 px-2">{String(s.investment_name)}</td>
                <td className="py-2 px-2">{inr(s.amount as number)}</td>
                <td className="py-2 px-2">{ddmmyyyy(s.start_date as string)}</td>
                <td className="py-2 px-2 capitalize">{String(s.status)}</td>
                <td className="py-2 px-2">{Number(s.recorded_installments)}</td>
                <td className="py-2 px-2">{inr(s.total_contributed as number)}</td>
                <td className="py-2 px-2 text-right">
                  <button className="p-1 hover:text-rose-600"
                    onClick={async () => { if (!confirmMsg('Delete this SIP plan? Recorded transactions remain.')) return; await api.del('/investments/sip/plans/' + s.id); load() }}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {sips.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-400">No SIP plans yet</td></tr>}
          </Table>
          <AddSip investmentId={null} onSaved={load} investments={rows} />
        </Card>
      )}

      {adding && <Modal title={editing ? 'Edit investment' : 'Add investment'} onClose={() => { setAdding(false); setEditing(null) }}>{editForm}</Modal>}

      {detail && (
        <Modal title={`${detail.name} — transaction history`} onClose={() => setDetail(null)} wide>
          <p className="text-sm text-slate-400 mb-2">
            Invested {inr(detail.performance?.contributed)} · Withdrawn {inr(detail.performance?.withdrawn)} ·
            {' '}Units {detail.performance?.units_held ?? '—'} ·
            {' '}Realized {inr(detail.performance?.realized_gain)} · Unrealized {inr(detail.performance?.unrealized_gain)} ·
            {' '}XIRR {detail.performance?.xirr != null ? (detail.performance.xirr * 100).toFixed(1) + '%' : 'Insufficient data'}
          </p>
          <Table head={['Date', 'Type', 'Amount', 'Units', 'NAV/Price', 'Notes', '']}>
            {detailTx.map((t: Record<string, unknown>) => (
              <tr key={String(t.id)} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-1.5 px-2">{ddmmyyyy(t.date as string)}</td>
                <td className="py-1.5 px-2 capitalize">{String(t.tx_type).replace('_', ' ')}</td>
                <td className="py-1.5 px-2">{inr(t.amount as number)}</td>
                <td className="py-1.5 px-2">{t.units != null ? String(t.units) : '—'}</td>
                <td className="py-1.5 px-2">{t.nav != null ? String(t.nav) : '—'}</td>
                <td className="py-1.5 px-2">{(t.notes as string) || '—'}</td>
                <td className="py-1.5 px-2 text-right">
                  <button className="p-1 hover:text-rose-600" onClick={async () => {
                    if (!confirmMsg('Delete this investment transaction?')) return
                    await api.del('/investments/transactions/' + t.id); openDetail(detail); load()
                  }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {detailTx.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-400">No transactions yet</td></tr>}
          </Table>
          <AddInvTx investmentId={detail.id} onSaved={() => { openDetail(detail); load() }} />
        </Modal>
      )}
    </div>
  )
}

function AddInvTx({ investmentId, onSaved }: { investmentId: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pt-3">
      <Btn onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={14} /> Add transaction</span></Btn>
      {open && (
        <Modal title="Add investment transaction" onClose={() => setOpen(false)}>
          <InvTxForm investmentId={investmentId} onDone={() => { setOpen(false); onSaved() }} />
        </Modal>
      )}
    </div>
  )
}
function AddSip({ investments, onSaved }: { investmentId: number | null; onSaved: () => void; investments: Investment[] }) {
  const [open, setOpen] = useState(false)
  const { boot } = useApp()
  const [f, setF] = useState({ investment_id: '', amount: '', frequency: 'monthly', start_date: today(), notes: '' })
  const [err, setErr] = useState<unknown>(null)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/investments/sip/plans', {
        investment_id: Number(f.investment_id), amount: Number(f.amount), frequency: f.frequency,
        start_date: f.start_date, notes: f.notes
      })
      setOpen(false); onSaved()
    } catch (e2) { setErr(e2) }
  }
  return (
    <div className="pt-3">
      <Btn tone="ghost" onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={14} /> Add SIP plan</span></Btn>
      {open && (
        <Modal title="Add SIP plan" onClose={() => setOpen(false)}>
          {err ? <Err err={err} /> : null}
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fund / investment">
                <select required className={inputCls} value={f.investment_id} onChange={e => set('investment_id', e.target.value)}>
                  <option value="">Select…</option>
                  {investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
              <Field label="SIP amount (₹)"><input type="number" required step="0.01" min="1" className={inputCls} value={f.amount} onChange={e => set('amount', e.target.value)} /></Field>
              <Field label="Frequency">
                <select className={inputCls} value={f.frequency} onChange={e => set('frequency', e.target.value)}>
                  <option value="monthly">monthly</option><option value="quarterly">quarterly</option>
                </select>
              </Field>
              <Field label="Start date"><input type="date" required className={inputCls} value={f.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
            </div>
            <p className="text-xs text-slate-400">Only installments you actually record as purchase transactions count toward totals.</p>
            <div className="flex justify-end"><Btn>Save SIP plan</Btn></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
