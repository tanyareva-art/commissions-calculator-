import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Pencil, Trash2, FileText, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import { calcRenewalRate, getEmployeeBonusRate, fmt$, fmtPct } from '../utils/calculations'

// ── Employee Form ─────────────────────────────────────────────────────────────

const emptyForm = { name: '', email: '', phone: '', title: '' }

function EmployeeForm({ initial = emptyForm, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [errs, setErrs] = useState({})
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.name.trim()) { setErrs({ name: 'Name is required' }); return }
    onSave({ ...form, name: form.name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Full Name *</label>
        <input className={`input ${errs.name ? 'input-error' : ''}`} value={form.name} onChange={set('name')} placeholder="Jane Smith" />
        {errs.name && <p className="field-error">{errs.name}</p>}
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="jane@agency.com" />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
      </div>
      <div>
        <label className="label">Title / Role</label>
        <input className="input" value={form.title} onChange={set('title')} placeholder="Producer" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">Save Employee</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

// ── Metric Box ────────────────────────────────────────────────────────────────

function Metric({ label, value, colorClass }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Employees() {
  const { state, dispatch, getEmployeePolicies } = useApp()
  const { employees, policies } = state

  const [modal, setModal] = useState(null)
  const closeModal = () => setModal(null)

  const handleAdd    = form => { dispatch({ type: 'ADD_EMPLOYEE',    payload: form }); closeModal() }
  const handleEdit   = form => { dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...form, id: modal.employee.id } }); closeModal() }
  const handleDelete = ()   => { dispatch({ type: 'DELETE_EMPLOYEE', payload: modal.employee.id }); closeModal() }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">{employees.length} producer{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* Empty state */}
      {employees.length === 0 && (
        <div className="card empty-state">
          <UserPlus size={40} className="mb-3 opacity-20" />
          <p className="font-medium text-slate-500">No employees yet</p>
          <p className="text-sm mt-1">Add your first producer to get started.</p>
          <button className="btn-primary mt-4" onClick={() => setModal({ type: 'add' })}>
            <UserPlus size={16} /> Add Employee
          </button>
        </div>
      )}

      {/* Employee Cards */}
      <div className="space-y-4">
        {employees.map(emp => {
          const empPolicies    = getEmployeePolicies(emp.id)
          const { rate, renewed, total } = calcRenewalRate(policies, emp.id)
          const bonusRate      = getEmployeeBonusRate(rate)
          const activePols     = empPolicies.filter(p => p.status !== 'cancelled').length
          const bonusEarned    = empPolicies.reduce((s, p) => s + (p.bonusAmount    ?? 0), 0)
          const adjTotal       = empPolicies.reduce((s, p) => s + (p.adjustmentTotal ?? 0), 0)
          const netBonus       = empPolicies.reduce((s, p) => s + (p.netBonus       ?? 0), 0)
          const clawbacks      = empPolicies.filter(p => p.status === 'cancelled')
            .reduce((s, p) => s + (p.clawbackAmount ?? 0), 0)
          const netPayout      = netBonus - clawbacks

          const tierLabel = bonusRate === 0.10 ? 'High Tier (10%)' : bonusRate === 0.08 ? 'Std Tier (8%)' : '—'
          const tierClass = bonusRate === 0.10 ? 'badge-green' : bonusRate === 0.08 ? 'badge-amber' : 'badge-gray'
          const rateColor = bonusRate === 0.10 ? 'text-emerald-700' : bonusRate === 0.08 ? 'text-amber-700' : 'text-slate-400'
          const renewColor = rate === null ? 'text-slate-400' : rate > 0.80 ? 'text-emerald-700' : 'text-amber-700'

          return (
            <div key={emp.id} className="card p-5">
              <div className="flex items-start gap-4">

                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">

                    {/* Name + tier */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-lg">{emp.name}</p>
                        {bonusRate !== null && <span className={`badge ${tierClass}`}>{tierLabel}</span>}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {emp.title && <span>{emp.title}</span>}
                        {emp.title && emp.email && <span> · </span>}
                        {emp.email && <span>{emp.email}</span>}
                        {emp.phone && <span> · {emp.phone}</span>}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link to={`/policies?employee=${emp.id}`}
                        className="btn btn-secondary text-xs py-1.5 px-3">
                        <FileText size={13} /> Policies
                        <ChevronRight size={12} />
                      </Link>
                      <button onClick={() => setModal({ type: 'edit', employee: emp })}
                        className="btn btn-secondary text-xs py-1.5 px-3">
                        <Pencil size={13} /> Edit
                      </button>
                      <button onClick={() => setModal({ type: 'delete', employee: emp })}
                        className="btn-ghost btn-icon text-slate-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-7 gap-2">
                    <Metric label="Policies"   value={activePols}  />
                    <Metric label="Renewals"   value={total > 0 ? `${renewed}/${total}` : '—'} />
                    <Metric label="Renewal %"  value={fmtPct(rate)}       colorClass={renewColor} />
                    <Metric label="Bonus Rate" value={bonusRate != null ? fmtPct(bonusRate, 0) : '—'} colorClass={rateColor} />
                    <Metric label="Base Bonus" value={fmt$(bonusEarned)}   colorClass="text-emerald-700" />
                    <Metric
                      label="End. Adj"
                      value={adjTotal !== 0 ? `${adjTotal > 0 ? '+' : ''}${fmt$(adjTotal)}` : '—'}
                      colorClass={adjTotal > 0 ? 'text-emerald-700' : adjTotal < 0 ? 'text-red-600' : 'text-slate-400'}
                    />
                    <Metric label="Net Payout" value={fmt$(netPayout)}    colorClass="text-blue-700" />
                  </div>

                  {/* Clawback warning */}
                  {clawbacks > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                      <span className="font-semibold">Clawbacks:</span> −{fmt$(clawbacks)}
                      <span className="text-red-400 ml-1">applied to cancelled policies</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add Employee" onClose={closeModal}>
          <EmployeeForm onSave={handleAdd} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Employee" onClose={closeModal}>
          <EmployeeForm initial={modal.employee} onSave={handleEdit} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete Employee" onClose={closeModal} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Delete <strong>{modal.employee.name}</strong>?{' '}
              {(() => {
                const n = getEmployeePolicies(modal.employee.id).length
                return n > 0 ? <span className="text-red-600">This will also delete {n} associated {n === 1 ? 'policy' : 'policies'}.</span> : null
              })()}
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="btn-danger flex-1 justify-center">Delete</button>
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
