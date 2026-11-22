import { useState } from 'react'
import { Modal, Btn } from './ui'
import TxForm from './TxForm'
import AssetForm from './AssetForm'
import LiabilityForm from './LiabilityForm'
import InvTxForm from './InvTxForm'

const KINDS = [
  { id: 'transaction', label: 'Income / Expense / Transfer' },
  { id: 'invtx', label: 'Investment transaction' },
  { id: 'asset', label: 'Asset' },
  { id: 'liability', label: 'Liability' }
]

export default function QuickAdd({ defaultType, onClose }: { defaultType: string; onClose: () => void }) {
  const [kind, setKind] = useState(defaultType)
  return (
    <Modal title="Quick Add" onClose={onClose} wide>
      <div className="flex gap-2 mb-4 flex-wrap">
        {KINDS.map(k => (
          <button key={k.id} onClick={() => setKind(k.id)}
            className={`px-3 py-1.5 rounded border text-sm ${kind === k.id ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-600'}`}>
            {k.label}
          </button>
        ))}
      </div>
      {kind === 'transaction' && <TxForm onDone={onClose} />}
      {kind === 'invtx' && <InvTxForm onDone={onClose} />}
      {kind === 'asset' && <AssetForm onDone={onClose} />}
      {kind === 'liability' && <LiabilityForm onDone={onClose} />}
      <div className="pt-2" />
      <Btn tone="ghost" onClick={onClose}>Close</Btn>
    </Modal>
  )
}
