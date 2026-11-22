import { FormEvent, useEffect, useState } from 'react'
import { Trash2, Download, Upload } from 'lucide-react'
import { api } from '../api'
import { useApp, confirmMsg } from '../store'
import { Card, Table, Btn, Field, inputCls, Err } from '../components/ui'

export default function SettingsPage() {
  const { boot, refresh } = useApp()
  const [err, setErr] = useState<unknown>(null)
  const [msg, setMsg] = useState('')
  const [newMember, setNewMember] = useState('')
  const [catKind, setCatKind] = useState('expense')
  const [newCat, setNewCat] = useState('')

  const addMember = async (e: FormEvent) => {
    e.preventDefault()
    try { await api.post('/meta/members', { name: newMember }); setNewMember(''); refresh() } catch (e2) { setErr(e2) }
  }
  const addCat = async (e: FormEvent) => {
    e.preventDefault()
    try { await api.post('/meta/categories', { kind: catKind, name: newCat }); setNewCat(''); refresh() } catch (e2) { setErr(e2) }
  }
  const restore = async (file: File) => {
    if (!confirmMsg('Restoring replaces ALL current data with the backup file. Continue?')) return
    const text = await file.text()
    try {
      await api.post('/reports/restore', JSON.parse(text))
      setMsg('Backup restored successfully.')
      refresh()
    } catch (e2) { setErr(e2) }
  }

  const cats = boot?.categories || []
  return (
    <div className="space-y-4">
      {err ? <Err err={err} /> : null}
      {msg && <div className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded px-3 py-2">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Family members">
          <form onSubmit={addMember} className="flex gap-2 mb-3">
            <input className={inputCls + ' mt-0 flex-1'} placeholder="New member name" value={newMember} onChange={e => setNewMember(e.target.value)} required />
            <Btn>Add</Btn>
          </form>
          <Table head={['Name', 'Role', '']}>
            {(boot?.members || []).map(m => (
              <tr key={m.id} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-1.5 px-2">{m.name}</td>
                <td className="py-1.5 px-2 capitalize text-slate-400">{m.kind}</td>
                <td className="py-1.5 px-2 text-right">
                  {m.kind !== 'household' && (
                    <button className="p-1 hover:text-rose-600" onClick={async () => {
                      if (!confirmMsg(`Delete member ${m.name}?`)) return
                      try { await api.del('/meta/members/' + m.id); refresh() } catch (e2) { setErr(e2) }
                    }}><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Categories (income & expense)">
          <form onSubmit={addCat} className="flex gap-2 mb-3">
            <select className={inputCls + ' mt-0'} value={catKind} onChange={e => setCatKind(e.target.value)}>
              <option value="income">Income</option><option value="expense">Expense</option>
            </select>
            <input className={inputCls + ' mt-0 flex-1'} placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} required />
            <Btn>Add</Btn>
          </form>
          <div className="max-h-56 overflow-y-auto">
            <Table head={['Category', 'Kind', '']}>
              {cats.map(c => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="py-1.5 px-2">{c.name}</td>
                  <td className="py-1.5 px-2 capitalize text-slate-400">{c.kind}</td>
                  <td className="py-1.5 px-2 text-right">
                    <button className="p-1 hover:text-rose-600" onClick={async () => {
                      if (!confirmMsg(`Delete category ${c.name}?`)) return
                      try { await api.del('/meta/categories/' + c.id); refresh() } catch (e2) { setErr(e2) }
                    }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>

      <Card title="Backup & restore">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          All data is stored in a single SQLite database file on this computer
          (<code className="text-xs">backend/data/fwm.db</code>). Take regular JSON backups.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => window.open('/api/reports/export/backup', '_blank')}>
            <span className="flex items-center gap-1"><Download size={14} /> Download full backup (JSON)</span>
          </Btn>
          <label className="cursor-pointer px-3 py-1.5 rounded font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300">
            <span className="flex items-center gap-1"><Upload size={14} /> Restore from backup</span>
            <input type="file" accept="application/json" className="hidden"
              onChange={e => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
          <Btn tone="ghost" onClick={() => window.open('/api/reports/export/excelWorkbook', '_blank')}>
            <span className="flex items-center gap-1">Excel workbook export</span>
          </Btn>
        </div>
      </Card>
    </div>
  )
}
