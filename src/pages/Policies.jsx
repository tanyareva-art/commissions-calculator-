import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FilePlus, CheckCircle, XCircle, RotateCcw, Pencil, Trash2,
  AlertTriangle, ArrowRight, ChevronDown, ChevronUp, PlusCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import ClawbackDetailModal from '../components/ClawbackDetailModal'
import {
  fmt$, fmtPct, fmtDate, today, getCurrentPremium,
  calcCancellationClawback, calcEndorsementAdjustment, getEmployeeBonusRate, calcRenewalRate,
  GREAT_WEST_CARRIER, BONUS_RATE_GW, BONUS_RATE_HIGH, BONUS_RATE_LOW,
} from '../utils/calculations'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARRIERS = [
  'Great West', 'Progressive', 'Sentry Insurance', 'Canal Insurance',
  'Protective Insurance', 'National Interstate', 'Old Republic', 'Other',
]

const POLICY_TYPES = [
  { value: 'new_business', label: 'New Business' },
  { value: 'renewal',      label: 'Renewal'      },
  { value: 'rewrite',      label: 'Rewrite'      },
]

const STATUS_BADGE = {
  active:    'badge-blue',
  renewed:   'badge-green',
  cancelled: 'badge-red',
  lost:      'badge-gray',
}
const STATUS_LABEL = { active: 'Active', renewed: 'Renewed', cancelled: 'Cancelled', lost: 'Lost' }

// ── Validation ────────────────────────────────────────────────────────────────

function validatePolicy(form) {
  const errs = {}
  if (!form.employeeId)     errs.employeeId    = 'Select an employee'
  if (!form.carrier)        errs.carrier       = 'Select a carrier'
  if (!form.effectiveDate)  errs.effectiveDate  = 'Enter effective date'
  if (!form.expirationDate) errs.expirationDate = 'Enter expiration date'
  if (!form.premium || parseFloat(form.premium) <= 0) errs.premium = 'Enter a valid premium'
  if (form.effectiveDate && form.expirationDate && form.effectiveDate >= form.expirationDate)
    errs.expirationDate = 'Expiration must be after effective date'
  return errs
}

// ── Policy Form ───────────────────────────────────────────────────────────────

function PolicyForm({ initial, employees, onSave, onCancel }) {
  const defaults = {
    policyNumber: '', insuredName: '', carrier: '', type: 'renewal',
    premium: '', renewalPremium: '', effectiveDate: today(),
    expirationDate: '', employeeId: '', notes: '', status: 'active',
  }
  const [form, setForm]   = useState({ ...defaults, ...initial, premium: initial?.premium ?? '', renewalPremium: initial?.renewalPremium ?? '' })
  const [errs, setErrs]   = useState({})
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    const errors = validatePolicy(form)
    if (Object.keys(errors).length) { setErrs(errors); return }
    onSave({
      ...form,
      premium:        parseFloat(form.premium) || 0,
      renewalPremium: form.renewalPremium !== '' ? parseFloat(form.renewalPremium) || null : null,
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
          <select className={`input ${errs.employeeId ? 'input-error' : ''}`} value={form.employeeId} onChange={set('employeeId')}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {errs.employeeId && <p className="field-error">{errs.employeeId}</p>}
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
        <select className={`input ${errs.carrier ? 'input-error' : ''}`} value={form.carrier} onChange={set('carrier')}>
          <option value="">Select carrier…</option>
          {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {errs.carrier && <p className="field-error">{errs.carrier}</p>}
        {form.carrier === GREAT_WEST_CARRIER && (
          <p className="text-xs text-yellow-700 mt-1 font-medium">⚠ Great West: 2% bonus rate override applies</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Expiring Premium (GWP) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input className={`input pl-6 ${errs.premium ? 'input-error' : ''}`} type="number" min="0" step="0.01"
              value={form.premium} onChange={set('premium')} placeholder="0.00" />
          </div>
          {errs.premium && <p className="field-error">{errs.premium}</p>}
        </div>
        <div>
          <label className="label">Renewal Premium (if known)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input className="input pl-6" type="number" min="0" step="0.01"
              value={form.renewalPremium} onChange={set('renewalPremium')} placeholder="Same as expiring if blank" />
          </div>
          <p className="text-xs text-slate-400 mt-1">Bonus uses this amount. Set when marking renewed if unknown now.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Effective Date *</label>
          <input className={`input ${errs.effectiveDate ? 'input-error' : ''}`} type="date" value={form.effectiveDate} onChange={set('effectiveDate')} />
          {errs.effectiveDate && <p className="field-error">{errs.effectiveDate}</p>}
        </div>
        <div>
          <label className="label">Expiration Date *</label>
          <input className={`input ${errs.expirationDate ? 'input-error' : ''}`} type="date" value={form.expirationDate} onChange={set('expirationDate')} />
          {errs.expirationDate && <p className="field-error">{errs.expirationDate}</p>}
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">
          {initial?.id ? 'Save Changes' : 'Add Policy'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ── Mark Renewed Modal ────────────────────────────────────────────────────────

function MarkRenewedModal({ policy, onSave, onCancel }) {
  const [fpd, setFpd]     = useState(today())
  const [prem, setPrem]   = useState(String(policy.renewalPremium ?? policy.premium ?? ''))
  const [errs, setErrs]   = useState({})

  const handleSave = e => {
    e.preventDefault()
    const errors = {}
    if (!fpd) errors.fpd = 'Enter first payment date'
    if (!prem || parseFloat(prem) <= 0) errors.prem = 'Enter a valid renewal premium'
    if (Object.keys(errors).length) { setErrs(errors); return }
    onSave({ policyId: policy.id, firstPaymentDate: fpd, renewalPremium: parseFloat(prem) })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
        <strong>Marking as Renewed:</strong> {policy.insuredName || policy.policyNumber}<br />
        Recording first payment triggers the bonus calculation.
      </div>

      <div>
        <label className="label">First Payment Date *</label>
        <input className={`input ${errs.fpd ? 'input-error' : ''}`} type="date" value={fpd} onChange={e => setFpd(e.target.value)} />
        {errs.fpd && <p className="field-error">{errs.fpd}</p>}
      </div>

      <div>
        <label className="label">Renewal Premium (GWP) *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input className={`input pl-6 ${errs.prem ? 'input-error' : ''}`} type="number" min="0" step="0.01"
            value={prem} onChange={e => setPrem(e.target.value)} />
        </div>
        {errs.prem && <p className="field-error">{errs.prem}</p>}
        <p className="text-xs text-slate-400 mt-1">Bonus is calculated on this amount. Update if premium changed.</p>
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

// ── Add Endorsement Modal ─────────────────────────────────────────────────────

function AddEndorsementModal({ policy, policyEndorsements, empBonusRate, onSave, onCancel }) {
  const currentPremium = getCurrentPremium(policy, policyEndorsements)

  const [date, setDate]   = useState(today())
  const [newPrem, setNewPrem] = useState('')
  const [notes, setNotes] = useState('')
  const [errs, setErrs]   = useState({})

  const preview = useMemo(() => {
    const np = parseFloat(newPrem)
    if (!np || !date) return null
    const fakeEndorsement = { endorsementDate: date, previousPremium: currentPremium, newPremium: np }
    return calcEndorsementAdjustment(policy, fakeEndorsement, empBonusRate)
  }, [newPrem, date, policy, currentPremium, empBonusRate])

  const handleSave = e => {
    e.preventDefault()
    const errors = {}
    if (!date) errors.date = 'Enter endorsement date'
    if (!newPrem || parseFloat(newPrem) <= 0) errors.newPrem = 'Enter a valid premium'
    if (date < policy.effectiveDate) errors.date = 'Date must be on or after effective date'
    if (date > policy.expirationDate) errors.date = 'Date must be before expiration date'
    if (parseFloat(newPrem) === currentPremium) errors.newPrem = 'Premium must be different from current amount'
    if (Object.keys(errors).length) { setErrs(errors); return }
    onSave({ policyId: policy.id, endorsementDate: date, newPremium: parseFloat(newPrem), notes })
  }

  const isIncrease = parseFloat(newPrem) > currentPremium

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        <p><strong>Adding Endorsement:</strong> {policy.insuredName || policy.policyNumber}</p>
        <p className="mt-1">Current premium: <strong>{fmt$(currentPremium)}</strong></p>
      </div>

      <div>
        <label className="label">Endorsement Date *</label>
        <input className={`input ${errs.date ? 'input-error' : ''}`} type="date"
          min={policy.effectiveDate} max={policy.expirationDate}
          value={date} onChange={e => setDate(e.target.value)} />
        {errs.date && <p className="field-error">{errs.date}</p>}
      </div>

      <div>
        <label className="label">New Premium After Endorsement *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input className={`input pl-6 ${errs.newPrem ? 'input-error' : ''}`} type="number" min="0" step="0.01"
            value={newPrem} onChange={e => setNewPrem(e.target.value)} placeholder="0.00" />
        </div>
        {errs.newPrem && <p className="field-error">{errs.newPrem}</p>}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for endorsement…" />
      </div>

      {/* Live preview */}
      {preview && (
        <div className={`p-4 rounded-lg border text-sm ${isIncrease ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="font-bold mb-2 text-slate-700">Bonus Adjustment Preview</p>
          <div className="font-mono text-xs mb-2 text-slate-600">
            ({fmt$(preview.newPremium)} − {fmt$(preview.previousPremium)}) × {fmtPct(preview.rate, 0)} × {fmtPct(preview.pctRemaining)} remaining
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">
              Premium {isIncrease ? 'increases' : 'decreases'} by <strong>{fmt$(Math.abs(preview.premiumChange))}</strong>
              {' '}({preview.daysRemaining} days remaining)
            </span>
            <span className={`text-lg font-bold ${isIncrease ? 'text-emerald-700' : 'text-red-700'}`}>
              {isIncrease ? '+' : ''}{fmt$(preview.adjustment)}
            </span>
          </div>
          <p className={`text-xs mt-1 ${isIncrease ? 'text-emerald-600' : 'text-red-600'}`}>
            {isIncrease ? '+ Additional bonus for remaining term' : '− Chargeback for reduced premium'}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-amber flex-1 justify-center">
          <PlusCircle size={15} /> Add Endorsement
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ── Cancel Policy Modal ───────────────────────────────────────────────────────

function CancelPolicyModal({ policy, policyEndorsements, empBonusRate, onSave, onCancel, onViewDetail }) {
  const [cancelDate, setCancelDate] = useState(today())
  const [errs, setErrs] = useState({})

  const preview = useMemo(() => {
    if (!cancelDate) return null
    try { return calcCancellationClawback(policy, policyEndorsements, cancelDate, empBonusRate) }
    catch { return null }
  }, [cancelDate, policy, policyEndorsements, empBonusRate])

  const handleSave = e => {
    e.preventDefault()
    const errors = {}
    if (!cancelDate) errors.cancelDate = 'Enter cancellation date'
    if (cancelDate < policy.effectiveDate) errors.cancelDate = 'Date must be on or after effective date'
    if (Object.keys(errors).length) { setErrs(errors); return }
    onSave({ policyId: policy.id, cancellationDate: cancelDate })
  }

  const pct = preview ? Math.round(preview.pctElapsed * 100) : 0

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
        <strong>Cancelling:</strong> {policy.insuredName || policy.policyNumber}<br />
        Clawback will be calculated on the net bonus (base + endorsement adjustments).
      </div>

      <div>
        <label className="label">Cancellation Date *</label>
        <input className={`input ${errs.cancelDate ? 'input-error' : ''}`} type="date"
          value={cancelDate} onChange={e => setCancelDate(e.target.value)} />
        {errs.cancelDate && <p className="field-error">{errs.cancelDate}</p>}
      </div>

      {policy.bonusAmount == null && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          No bonus has been earned yet (policy not marked as renewed). No clawback will apply.
        </div>
      )}

      {preview && policy.bonusAmount != null && (
        <>
          {/* Timeline */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{fmtDate(policy.effectiveDate)}</span>
              <span className="text-red-600 font-medium">Cancel: {fmtDate(cancelDate)}</span>
              <span>{fmtDate(policy.expirationDate)}</span>
            </div>
            <div className="timeline-bar">
              <div className="timeline-elapsed" style={{ width: `${Math.min(100, pct)}%` }} />
              <div className="timeline-remaining" style={{ width: `${Math.min(100, 100 - pct)}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-emerald-700 font-medium">{preview.daysElapsed}d elapsed ({pct}%)</span>
              <span className="text-red-600 font-medium">{preview.daysRemaining}d remaining ({100 - pct}%)</span>
            </div>
          </div>

          {/* Summary numbers */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs font-bold text-emerald-700 mb-1">Base Bonus</p>
              <p className="font-bold text-emerald-800">{fmt$(preview.baseBonus)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-1">Endorsement Adj</p>
              <p className={`font-bold ${preview.totalAdjustments >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {preview.totalAdjustments >= 0 ? '+' : ''}{fmt$(preview.totalAdjustments)}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg border border-emerald-300">
              <p className="text-xs font-bold text-emerald-800 mb-1">Net Bonus</p>
              <p className="font-bold text-emerald-900">{fmt$(preview.netBonus)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs font-bold text-red-700 mb-1">Clawback ({100 - pct}%)</p>
              <p className="font-bold text-red-800">−{fmt$(preview.clawbackAmount)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-1">Final Payout</p>
              <p className="font-bold text-blue-800">{fmt$(preview.netAfterClawback)}</p>
            </div>
          </div>

          <button type="button" onClick={() => onViewDetail(preview)} className="w-full text-xs text-navy-700 hover:underline">
            View full formula breakdown →
          </button>
        </>
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

// ── Endorsements History Row ──────────────────────────────────────────────────

function EndorsementHistory({ endorsements, policy, empBonusRate, onDelete }) {
  if (endorsements.length === 0) return (
    <p className="text-xs text-slate-400 px-2">No endorsements recorded.</p>
  )
  return (
    <div className="space-y-1">
      {endorsements.map(e => {
        const adj = calcEndorsementAdjustment(policy, e, empBonusRate)
        return (
          <div key={e.id} className={`flex items-center gap-3 text-xs p-2 rounded-lg ${adj.isIncrease ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <span className="text-slate-500 w-20 shrink-0">{fmtDate(e.endorsementDate)}</span>
            <span className="text-slate-600">
              {fmt$(e.previousPremium)} <ArrowRight size={10} className="inline" /> {fmt$(e.newPremium)}
              <span className={`ml-1 font-semibold ${adj.isIncrease ? 'text-emerald-700' : 'text-red-700'}`}>
                ({adj.isIncrease ? '+' : ''}{fmt$(e.premiumChange)})
              </span>
            </span>
            <span className="ml-auto shrink-0">
              <span className={`font-bold ${adj.isIncrease ? 'text-emerald-700' : 'text-red-700'}`}>
                {adj.isIncrease ? '+' : ''}{fmt$(adj.adjustment)}
              </span>
            </span>
            <button onClick={() => onDelete(e.id)} className="text-slate-300 hover:text-red-400 transition-colors" title="Delete endorsement">
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Policies() {
  const { state, dispatch, getPolicyEndorsements } = useApp()
  const { employees, policies } = state
  const [searchParams] = useSearchParams()

  const [modal, setModal]           = useState(null)
  const [detailResult, setDetailResult] = useState(null)  // for ClawbackDetailModal
  const [detailPolicy, setDetailPolicy] = useState(null)
  const [detailDate, setDetailDate]     = useState(null)
  const [expanded, setExpanded]     = useState(new Set())  // expanded policy rows

  const [filter, setFilter] = useState({
    employeeId: searchParams.get('employee') || '',
    status: '', type: '', carrier: '', search: '',
  })

  const closeModal = () => setModal(null)

  // Compute employee bonus rate for a given employee (used in endorsement / cancel modals)
  const getEmpBonusRate = empId => {
    const { rate } = calcRenewalRate(policies, empId)
    return getEmployeeBonusRate(rate) ?? BONUS_RATE_LOW
  }

  // Filtered + sorted policy list
  const filtered = useMemo(() => {
    return policies.filter(p => {
      if (filter.employeeId && p.employeeId !== filter.employeeId) return false
      if (filter.status   && p.status   !== filter.status)   return false
      if (filter.type     && p.type     !== filter.type)     return false
      if (filter.carrier  && p.carrier  !== filter.carrier)  return false
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

  const toggleExpand = id => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // ── Action Handlers ───────────────────────────────────────────────────────

  const handleAdd           = form => { dispatch({ type: 'ADD_POLICY',            payload: form }); closeModal() }
  const handleEdit          = form => { dispatch({ type: 'UPDATE_POLICY',          payload: { ...form, id: modal.policy.id } }); closeModal() }
  const handleRenewed       = p    => { dispatch({ type: 'MARK_RENEWED',           payload: p }); closeModal() }
  const handleEndorse       = p    => { dispatch({ type: 'ADD_ENDORSEMENT',        payload: p }); closeModal() }
  const handleDeleteEndorse = id   => { dispatch({ type: 'DELETE_ENDORSEMENT',     payload: id }) }
  const handleCancel        = p    => { dispatch({ type: 'MARK_CANCELLED',         payload: p }); closeModal() }
  const handleReinstate     = id   => { dispatch({ type: 'REINSTATE_POLICY',       payload: id }) }
  const handleMarkLost      = id   => { dispatch({ type: 'MARK_LOST',              payload: id }) }
  const handleDelete        = id   => { dispatch({ type: 'DELETE_POLICY',          payload: id }); closeModal() }

  const openClawbackDetail = (result, policy, cancellationDate) => {
    setDetailResult(result)
    setDetailPolicy(policy)
    setDetailDate(cancellationDate)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} of {policies.length} shown</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
          <FilePlus size={16} /> Add Policy
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1">
            <input className="input text-sm" placeholder="Search policy # or insured…"
              value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
          </div>
          <select className="input text-sm" value={filter.employeeId} onChange={e => setFilter(f => ({ ...f, employeeId: e.target.value }))}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="input text-sm" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

      {/* ── Policy Table ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card empty-state">
          <FilePlus size={40} className="mb-3 opacity-20" />
          <p className="font-medium text-slate-500">{policies.length === 0 ? 'No policies yet' : 'No matching policies'}</p>
          {policies.length === 0 && (
            <button className="btn-primary mt-4" onClick={() => setModal({ type: 'add' })}>
              <FilePlus size={16} /> Add Policy
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-6" />
                  <th>Insured / Policy #</th>
                  <th>Employee</th>
                  <th>Carrier · Type</th>
                  <th className="text-right">Renewal Premium</th>
                  <th className="text-center">Dates</th>
                  <th className="text-center">Status</th>
                  <th className="text-right th-green">Base Bonus</th>
                  <th className="text-right th-amber">End. Adj</th>
                  <th className="text-right th-green">Net Bonus</th>
                  <th className="text-right th-red">Clawback</th>
                  <th className="text-right th-blue">Net Payout</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(policy => {
                  const policyEndorsements = getPolicyEndorsements(policy.id)
                  const empBonusRate       = getEmpBonusRate(policy.employeeId)
                  const isExpanded         = expanded.has(policy.id)
                  const currentPrem        = getCurrentPremium(policy, policyEndorsements)
                  const netPayout          = (policy.netBonus ?? 0) - (policy.clawbackAmount ?? 0)
                  const hasEndorsements    = policyEndorsements.length > 0

                  return (
                    <React.Fragment key={policy.id}>
                      <tr className={isExpanded ? 'bg-slate-50/80' : ''}>
                        {/* Expand toggle */}
                        <td className="pl-2 pr-0">
                          <button onClick={() => toggleExpand(policy.id)} className="btn-ghost btn-icon text-slate-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Insured */}
                        <td>
                          <p className="font-semibold text-slate-900">{policy.insuredName || '—'}</p>
                          <p className="text-xs text-slate-400">{policy.policyNumber || 'No #'}</p>
                        </td>

                        {/* Employee */}
                        <td className="text-slate-700">{getEmpName(policy.employeeId)}</td>

                        {/* Carrier */}
                        <td>
                          <span className={policy.carrier === GREAT_WEST_CARRIER ? 'font-semibold text-yellow-700' : 'text-slate-800'}>
                            {policy.carrier}
                            {policy.carrier === GREAT_WEST_CARRIER && <span className="ml-1 badge badge-yellow">2%</span>}
                          </span>
                          <p className="text-xs text-slate-400 capitalize">{policy.type?.replace('_', ' ')}</p>
                        </td>

                        {/* Premium */}
                        <td className="text-right">
                          <p className="font-medium text-slate-900">{fmt$(currentPrem)}</p>
                          {policy.premium && policy.premium !== currentPrem && (
                            <p className="text-xs text-slate-400">Exp: {fmt$(policy.premium)}</p>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="text-center">
                          <p className="text-xs text-slate-500">{fmtDate(policy.effectiveDate)}</p>
                          <p className="text-xs text-slate-300">—</p>
                          <p className="text-xs text-slate-500">{fmtDate(policy.expirationDate)}</p>
                        </td>

                        {/* Status */}
                        <td className="text-center">
                          <span className={`badge ${STATUS_BADGE[policy.status] ?? 'badge-gray'}`}>
                            {STATUS_LABEL[policy.status] ?? policy.status}
                          </span>
                          {policy.firstPaymentDate && (
                            <p className="text-xs text-slate-400 mt-1">{fmtDate(policy.firstPaymentDate)}</p>
                          )}
                        </td>

                        {/* Base Bonus */}
                        <td className="text-right td-bonus">
                          {policy.bonusAmount != null
                            ? <>{fmt$(policy.bonusAmount)}<p className="text-xs text-slate-400">{fmtPct(policy.bonusRate, 0)}</p></>
                            : <span className="td-muted">—</span>}
                        </td>

                        {/* Endorsement Adj */}
                        <td className="text-right">
                          {policy.adjustmentTotal != null && policy.adjustmentTotal !== 0 ? (
                            <span className={policy.adjustmentTotal > 0 ? 'td-adj-pos' : 'td-adj-neg'}>
                              {policy.adjustmentTotal > 0 ? '+' : ''}{fmt$(policy.adjustmentTotal)}
                            </span>
                          ) : <span className="td-muted">—</span>}
                        </td>

                        {/* Net Bonus */}
                        <td className="text-right td-bonus">
                          {policy.netBonus != null
                            ? fmt$(policy.netBonus)
                            : <span className="td-muted">—</span>}
                        </td>

                        {/* Clawback */}
                        <td className="text-right">
                          {policy.clawbackAmount != null && policy.clawbackAmount > 0 ? (
                            <button
                              onClick={() => {
                                const result = calcCancellationClawback(policy, policyEndorsements, policy.cancellationDate, empBonusRate)
                                openClawbackDetail(result, policy, policy.cancellationDate)
                              }}
                              className="td-claw hover:underline cursor-pointer"
                            >
                              −{fmt$(policy.clawbackAmount)}
                            </button>
                          ) : <span className="td-muted">—</span>}
                        </td>

                        {/* Net Payout */}
                        <td className="text-right td-net">
                          {policy.netBonus != null ? fmt$(netPayout) : <span className="td-muted">—</span>}
                        </td>

                        {/* Actions */}
                        <td className="pr-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {!policy.firstPaymentDate && policy.status !== 'cancelled' && policy.status !== 'lost' && (
                              <button onClick={() => setModal({ type: 'renew', policy })}
                                className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">
                                Renew
                              </button>
                            )}
                            {policy.firstPaymentDate && policy.status !== 'cancelled' && (
                              <button onClick={() => setModal({ type: 'endorse', policy })}
                                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">
                                Endorse
                              </button>
                            )}
                            {policy.status !== 'cancelled' && policy.status !== 'lost' && (
                              <button onClick={() => setModal({ type: 'cancel', policy })}
                                className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium">
                                Cancel
                              </button>
                            )}
                            {!policy.firstPaymentDate && policy.status === 'active' && (
                              <button onClick={() => handleMarkLost(policy.id)}
                                className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium">
                                Lost
                              </button>
                            )}
                            {(policy.status === 'cancelled' || policy.status === 'lost') && (
                              <button onClick={() => handleReinstate(policy.id)}
                                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">
                                Reinstate
                              </button>
                            )}
                            <button onClick={() => setModal({ type: 'edit', policy })}
                              className="btn-ghost btn-icon text-slate-400" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setModal({ type: 'delete', policy })}
                              className="btn-ghost btn-icon text-slate-400 hover:text-red-500" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded endorsement history row ────────────────── */}
                      {isExpanded && (
                        <tr>
                          <td />
                          <td colSpan={12} className="pb-3 pt-0 pl-4">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Endorsement History
                                {hasEndorsements && (
                                  <span className="ml-2 badge badge-amber">{policyEndorsements.length} endorsement{policyEndorsements.length !== 1 ? 's' : ''}</span>
                                )}
                              </p>
                              <EndorsementHistory
                                endorsements={policyEndorsements}
                                policy={policy}
                                empBonusRate={empBonusRate}
                                onDelete={handleDeleteEndorse}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal?.type === 'add' && (
        <Modal title="Add Policy" onClose={closeModal} size="lg">
          <PolicyForm employees={employees} onSave={handleAdd} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Policy" onClose={closeModal} size="lg">
          <PolicyForm initial={modal.policy} employees={employees} onSave={handleEdit} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'renew' && (
        <Modal title="Mark as Renewed" onClose={closeModal}>
          <MarkRenewedModal policy={modal.policy} onSave={handleRenewed} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'endorse' && (
        <Modal title="Add Endorsement" onClose={closeModal}>
          <AddEndorsementModal
            policy={modal.policy}
            policyEndorsements={getPolicyEndorsements(modal.policy.id)}
            empBonusRate={getEmpBonusRate(modal.policy.employeeId)}
            onSave={handleEndorse}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal?.type === 'cancel' && (
        <Modal title="Cancel Policy" onClose={closeModal}>
          <CancelPolicyModal
            policy={modal.policy}
            policyEndorsements={getPolicyEndorsements(modal.policy.id)}
            empBonusRate={getEmpBonusRate(modal.policy.employeeId)}
            onSave={handleCancel}
            onCancel={closeModal}
            onViewDetail={(result) => openClawbackDetail(result, modal.policy, result?.cancellationDate)}
          />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete Policy" onClose={closeModal} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Delete <strong>{modal.policy.insuredName || modal.policy.policyNumber}</strong>?
              This will also delete any endorsements and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(modal.policy.id)} className="btn-danger flex-1 justify-center">Delete</button>
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clawback detail modal */}
      {detailResult && detailPolicy && (
        <ClawbackDetailModal
          result={detailResult}
          policy={detailPolicy}
          cancellationDate={detailDate ?? detailPolicy.cancellationDate}
          onClose={() => { setDetailResult(null); setDetailPolicy(null); setDetailDate(null) }}
        />
      )}
    </div>
  )
}
