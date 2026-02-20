import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FilePlus, CheckCircle, XCircle, RotateCcw, Pencil, Trash2,
  ChevronDown, Filter, DollarSign, AlertCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import {
  fmt$, fmtPct, fmtDate, today, calcClawback,
  GREAT_WEST_CARRIER, BONUS_RATE_HIGH, BONUS_RATE_LOW, BONUS_RATE_GW,
} from '../utils/calculations'

const CARRIERS = [
  'Great West',
  'Progressive',
  'Sentry Insurance',
  'Canal Insurance',
  'Protective Insurance',
  'National Interstate',
  'Old Republic',
  'Other',
]

const POLICY_TYPES = [
  { value: 'new_business', label: 'New Business' },
  { value: 'renewal',      label: 'Renewal'      },
  { value: 'rewrite',      label: 'Rewrite'      },
]

const STATUSES = ['active', 'renewed', 'cancelled', 'lost']

const statusBadge = {
  active:   'badge-blue',
  renewed:  'badge-green',
  cancelled:'badge-red',
  lost:     'badge-gray',
}

const statusLabel = {
  active:   'Active',
  renewed:  'Renewed',
  cancelled:'Cancelled',
  lost:     'Lost',
}

const emptyForm = {
  policyNumber: '',
  insuredName: '',
  carrier: '',
  type: 'renewal',
  premium: '',
  renewalPremium: '',
  effectiveDate: today(),
  expirationDate: '',
  employeeId: '',
  notes: '',
  status: 'active',
}

// ─── Add/Edit Policy Form ──────────────────────────────────────────────────────
function PolicyForm({ initial = emptyForm, employees, onSave, onCancel, isEdit = false }) {
  const [form, setForm] = useState({
    ...emptyForm,
    ...initial,
    premium: initial.premium ?? '',
    renewalPremium: initial.renewalPremium ?? '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.employeeId || !form.carrier || !form.effectiveDate || !form.expirationDate) return
    onSave({
      ...form,
      premium: parseFloat(form.premium) || 0,
      renewalPremium: form.renewalPremium !== '' ? parseFloat(form.renewalPremium) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Policy Number</label>
          <input className="input" value={form.policyNumber} onChange={set('policyNumber')} placeholder="TRK-000000" />
        </div>
        <div>
          <label className="label">Insured Name</label>
          <input className="input" value={form.insuredName} onChange={set('insuredName')} placeholder="ACME Trucking LLC" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Employee *</label>
          <select className="input" value={form.employeeId} onChange={set('employeeId')} required>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Policy Type *</label>
          <select className="input" value={form.type} onChange={set('type')}>
            {POLICY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Carrier *</label>
        <select className="input" value={form.carrier} onChange={set('carrier')} required>
          <option value="">Select carrier…</option>
          {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {form.carrier === GREAT_WEST_CARRIER && (
          <p className="text-xs text-blue-600 mt-1">Great West policies earn 2% bonus (carrier override).</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">GWP (Expiring Premium) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input className="input pl-7" type="number" min="0" step="0.01"
              value={form.premium} onChange={set('premium')} placeholder="0.00" required />
          </div>
        </div>
        <div>
          <label className="label">Renewal Premium (if known)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input className="input pl-7" type="number" min="0" step="0.01"
              value={form.renewalPremium} onChange={set('renewalPremium')} placeholder="Leave blank if same" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Bonus calculates on this amount (or expiring premium if blank).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Effective Date *</label>
          <input className="input" type="date" value={form.effectiveDate} onChange={set('effectiveDate')} required />
        </div>
        <div>
          <label className="label">Expiration Date *</label>
          <input className="input" type="date" value={form.expirationDate} onChange={set('expirationDate')} required />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">
          {isEdit ? 'Save Changes' : 'Add Policy'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ─── Mark Renewed Modal ───────────────────────────────────────────────────────
function MarkRenewedModal({ policy, onSave, onCancel }) {
  const [firstPaymentDate, setFirstPaymentDate] = useState(today())
  const [renewalPremium, setRenewalPremium] = useState(
    policy.renewalPremium ? String(policy.renewalPremium) : String(policy.premium || '')
  )

  const handleSave = e => {
    e.preventDefault()
    onSave({
      policyId: policy.id,
      firstPaymentDate,
      renewalPremium: parseFloat(renewalPremium) || policy.renewalPremium || policy.premium,
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
        <strong>Marking as Renewed:</strong> {policy.insuredName || policy.policyNumber}<br />
        This records first payment received and calculates the renewal bonus.
      </div>

      <div>
        <label className="label">First Payment Date *</label>
        <input className="input" type="date" value={firstPaymentDate} onChange={e => setFirstPaymentDate(e.target.value)} required />
      </div>

      <div>
        <label className="label">Renewal Premium (GWP) *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input className="input pl-7" type="number" min="0" step="0.01"
            value={renewalPremium} onChange={e => setRenewalPremium(e.target.value)} required />
        </div>
        <p className="text-xs text-gray-500 mt-1">Bonus is calculated on this amount. Update if premium changed.</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-success flex-1 justify-center">
          <CheckCircle size={15} /> Mark as Renewed
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ─── Update Premium Modal ─────────────────────────────────────────────────────
function UpdatePremiumModal({ policy, onSave, onCancel }) {
  const [renewalPremium, setRenewalPremium] = useState(String(policy.renewalPremium ?? policy.premium ?? ''))

  const handleSave = e => {
    e.preventDefault()
    onSave({ policyId: policy.id, renewalPremium: parseFloat(renewalPremium) || 0 })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        Updating the premium will automatically recalculate the bonus for <strong>{policy.insuredName || policy.policyNumber}</strong>.
      </div>
      <div>
        <label className="label">New Renewal Premium *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input className="input pl-7" type="number" min="0" step="0.01"
            value={renewalPremium} onChange={e => setRenewalPremium(e.target.value)} required />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Update Premium</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ─── Cancel Policy Modal ──────────────────────────────────────────────────────
function CancelPolicyModal({ policy, onSave, onCancel }) {
  const [cancellationDate, setCancellationDate] = useState(today())

  const preview = useMemo(() => {
    if (!cancellationDate || !policy.bonusAmount) return null
    return calcClawback(policy, cancellationDate)
  }, [cancellationDate, policy])

  const handleSave = e => {
    e.preventDefault()
    const claw = preview ? preview.clawbackAmount : 0
    onSave({ policyId: policy.id, cancellationDate, clawbackAmount: claw })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-red-50 rounded-lg text-sm text-red-800">
        <strong>Cancelling policy:</strong> {policy.insuredName || policy.policyNumber}<br />
        If a bonus was paid, a prorated clawback will be calculated.
      </div>

      <div>
        <label className="label">Cancellation Date *</label>
        <input className="input" type="date" value={cancellationDate}
          onChange={e => setCancellationDate(e.target.value)} required />
      </div>

      {preview && (
        <div className="space-y-3">
          {/* Visual timeline */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Eff: {fmtDate(policy.effectiveDate)}</span>
              <span>Cancel: {fmtDate(cancellationDate)}</span>
              <span>Exp: {fmtDate(policy.expirationDate)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-l-full"
                style={{ width: `${Math.min(100, preview.pctElapsed * 100)}%` }}
              />
              <div
                className="h-full bg-red-400 absolute top-0"
                style={{
                  left: `${Math.min(100, preview.pctElapsed * 100)}%`,
                  width: `${Math.min(100, preview.pctRemaining * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-emerald-700">{preview.daysElapsed}d elapsed ({Math.round(preview.pctElapsed * 100)}%)</span>
              <span className="text-red-600">{preview.daysRemaining}d remaining ({Math.round(preview.pctRemaining * 100)}%)</span>
            </div>
          </div>

          {/* Clawback summary */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500">Bonus Earned</p>
              <p className="text-base font-bold text-emerald-700">{fmt$(preview.bonusEarned)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Clawback ({Math.round(preview.pctRemaining * 100)}%)</p>
              <p className="text-base font-bold text-red-600">-{fmt$(preview.clawbackAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Bonus</p>
              <p className="text-base font-bold text-gray-900">{fmt$(preview.netBonus)}</p>
            </div>
          </div>
        </div>
      )}

      {policy.bonusAmount === null && (
        <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
          No bonus was earned on this policy, so no clawback applies.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-danger flex-1 justify-center">
          <XCircle size={15} /> Confirm Cancellation
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Policies() {
  const { state, dispatch } = useApp()
  const { employees, policies } = state
  const [searchParams] = useSearchParams()

  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState({
    employeeId: searchParams.get('employee') || '',
    status: '',
    type: '',
    carrier: '',
    search: '',
  })

  const closeModal = () => setModal(null)

  // Filter policies
  const filtered = useMemo(() => {
    return policies.filter(p => {
      if (filter.employeeId && p.employeeId !== filter.employeeId) return false
      if (filter.status && p.status !== filter.status) return false
      if (filter.type && p.type !== filter.type) return false
      if (filter.carrier && p.carrier !== filter.carrier) return false
      if (filter.search) {
        const q = filter.search.toLowerCase()
        if (
          !p.policyNumber?.toLowerCase().includes(q) &&
          !p.insuredName?.toLowerCase().includes(q) &&
          !p.carrier?.toLowerCase().includes(q)
        ) return false
      }
      return true
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [policies, filter])

  const getEmpName = id => employees.find(e => e.id === id)?.name ?? '—'

  const handleAdd = form => {
    dispatch({ type: 'ADD_POLICY', payload: form })
    closeModal()
  }

  const handleEdit = form => {
    dispatch({ type: 'UPDATE_POLICY', payload: { ...form, id: modal.policy.id } })
    closeModal()
  }

  const handleRenewed = payload => {
    dispatch({ type: 'MARK_RENEWED', payload })
    closeModal()
  }

  const handleUpdatePremium = payload => {
    dispatch({ type: 'UPDATE_RENEWAL_PREMIUM', payload })
    closeModal()
  }

  const handleCancel = payload => {
    dispatch({ type: 'MARK_CANCELLED', payload })
    closeModal()
  }

  const handleReinstate = policyId => {
    dispatch({ type: 'REINSTATE_POLICY', payload: policyId })
  }

  const handleMarkLost = policyId => {
    dispatch({ type: 'MARK_LOST', payload: policyId })
  }

  const handleDelete = policyId => {
    dispatch({ type: 'DELETE_POLICY', payload: policyId })
    closeModal()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} of {policies.length} shown</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
          <FilePlus size={16} /> Add Policy
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1">
            <input
              className="input text-sm"
              placeholder="Search policy # or insured…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <select className="input text-sm" value={filter.employeeId} onChange={e => setFilter(f => ({ ...f, employeeId: e.target.value }))}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="input text-sm" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
          <select className="input text-sm" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            {POLICY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input text-sm" value={filter.carrier} onChange={e => setFilter(f => ({ ...f, carrier: e.target.value }))}>
            <option value="">All Carriers</option>
            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-16 text-center text-gray-400">
          <FilePlus size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500">{policies.length === 0 ? 'No policies yet' : 'No matching policies'}</p>
          {policies.length === 0 && (
            <button className="btn-primary mt-4" onClick={() => setModal({ type: 'add' })}>
              <FilePlus size={16} /> Add Policy
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Policy</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Carrier / Type</th>
                  <th className="px-4 py-3 text-right">Premium</th>
                  <th className="px-4 py-3 text-center">Dates</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Bonus</th>
                  <th className="px-4 py-3 text-right">Clawback</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(policy => {
                  const renewPrem = policy.renewalPremium ?? policy.premium
                  return (
                    <tr key={policy.id} className="hover:bg-gray-50 transition-colors">
                      {/* Policy # + insured */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{policy.insuredName || '—'}</div>
                        <div className="text-xs text-gray-400">{policy.policyNumber || 'No #'}</div>
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-3 text-gray-700">{getEmpName(policy.employeeId)}</td>

                      {/* Carrier / Type */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">
                          {policy.carrier}
                          {policy.carrier === GREAT_WEST_CARRIER && (
                            <span className="ml-1 text-xs text-blue-600 font-semibold">(2%)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">{policy.type?.replace('_', ' ')}</div>
                      </td>

                      {/* Premium */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{fmt$(renewPrem)}</div>
                        {policy.renewalPremium && policy.renewalPremium !== policy.premium && (
                          <div className="text-xs text-gray-400">Exp: {fmt$(policy.premium)}</div>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs text-gray-500">{fmtDate(policy.effectiveDate)}</div>
                        <div className="text-xs text-gray-300">—</div>
                        <div className="text-xs text-gray-500">{fmtDate(policy.expirationDate)}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={statusBadge[policy.status] ?? 'badge-gray'}>
                          {statusLabel[policy.status] ?? policy.status}
                        </span>
                        {policy.firstPaymentDate && (
                          <div className="text-xs text-gray-400 mt-1">Paid {fmtDate(policy.firstPaymentDate)}</div>
                        )}
                      </td>

                      {/* Bonus */}
                      <td className="px-4 py-3 text-right">
                        {policy.bonusAmount != null ? (
                          <>
                            <div className="font-semibold text-emerald-700">{fmt$(policy.bonusAmount)}</div>
                            <div className="text-xs text-gray-400">{fmtPct(policy.bonusRate, 0)} rate</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Clawback */}
                      <td className="px-4 py-3 text-right">
                        {policy.clawbackAmount != null && policy.clawbackAmount > 0 ? (
                          <>
                            <div className="font-semibold text-red-600">-{fmt$(policy.clawbackAmount)}</div>
                            <div className="text-xs text-gray-400">{fmtDate(policy.cancellationDate)}</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* Renew */}
                          {!policy.firstPaymentDate && policy.status !== 'cancelled' && policy.status !== 'lost' && (
                            <button
                              onClick={() => setModal({ type: 'renew', policy })}
                              className="text-xs px-2 py-1 rounded text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors font-medium"
                              title="Mark first payment received"
                            >
                              Renew
                            </button>
                          )}

                          {/* Update premium (after renewal) */}
                          {policy.firstPaymentDate && policy.status !== 'cancelled' && (
                            <button
                              onClick={() => setModal({ type: 'premium', policy })}
                              className="text-xs px-2 py-1 rounded text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors font-medium"
                              title="Update renewal premium"
                            >
                              Premium
                            </button>
                          )}

                          {/* Cancel */}
                          {policy.status !== 'cancelled' && policy.status !== 'lost' && (
                            <button
                              onClick={() => setModal({ type: 'cancel', policy })}
                              className="text-xs px-2 py-1 rounded text-red-700 bg-red-50 hover:bg-red-100 transition-colors font-medium"
                              title="Cancel policy"
                            >
                              Cancel
                            </button>
                          )}

                          {/* Mark lost */}
                          {!policy.firstPaymentDate && policy.status === 'active' && (
                            <button
                              onClick={() => handleMarkLost(policy.id)}
                              className="text-xs px-2 py-1 rounded text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors font-medium"
                              title="Mark as lost (did not renew)"
                            >
                              Lost
                            </button>
                          )}

                          {/* Reinstate */}
                          {(policy.status === 'cancelled' || policy.status === 'lost') && (
                            <button
                              onClick={() => handleReinstate(policy.id)}
                              className="text-xs px-2 py-1 rounded text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors font-medium"
                              title="Reinstate policy"
                            >
                              <RotateCcw size={11} className="inline" /> Reinstate
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: 'edit', policy })}
                            className="text-gray-400 hover:text-navy-700 transition-colors p-1"
                            title="Edit policy"
                          >
                            <Pencil size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setModal({ type: 'delete', policy })}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete policy"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add Policy" onClose={closeModal} size="lg">
          <PolicyForm employees={employees} onSave={handleAdd} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Policy" onClose={closeModal} size="lg">
          <PolicyForm initial={modal.policy} employees={employees} onSave={handleEdit} onCancel={closeModal} isEdit />
        </Modal>
      )}
      {modal?.type === 'renew' && (
        <Modal title="Mark as Renewed" onClose={closeModal}>
          <MarkRenewedModal policy={modal.policy} onSave={handleRenewed} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'premium' && (
        <Modal title="Update Renewal Premium" onClose={closeModal} size="sm">
          <UpdatePremiumModal policy={modal.policy} onSave={handleUpdatePremium} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'cancel' && (
        <Modal title="Cancel Policy" onClose={closeModal}>
          <CancelPolicyModal policy={modal.policy} onSave={handleCancel} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete Policy" onClose={closeModal} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Delete <strong>{modal.policy.insuredName || modal.policy.policyNumber}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(modal.policy.id)} className="btn-danger flex-1 justify-center">Delete</button>
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
