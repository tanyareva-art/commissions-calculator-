import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Pencil, Trash2, FileText, TrendingUp, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import { calcRenewalRate, getEmployeeBonusRate, fmt$, fmtPct, today } from '../utils/calculations'

const emptyForm = { name: '', email: '', phone: '', title: '' }

function EmployeeForm({ initial = emptyForm, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Full Name *</label>
        <input className="input" value={form.name} onChange={set('name')} required placeholder="Jane Smith" />
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

function DeleteConfirm({ employee, policyCount, onConfirm, onCancel }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Are you sure you want to delete <strong>{employee.name}</strong>?
        {policyCount > 0 && (
          <span className="text-red-600"> This will also delete {policyCount} associated {policyCount === 1 ? 'policy' : 'policies'}.</span>
        )}
      </p>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="btn-danger flex-1 justify-center">Delete</button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

export default function Employees() {
  const { state, dispatch, getEmployeePolicies } = useApp()
  const { employees, policies } = state

  const [modal, setModal] = useState(null) // null | { type: 'add' | 'edit' | 'delete', employee? }

  const closeModal = () => setModal(null)

  const handleAdd = form => {
    dispatch({ type: 'ADD_EMPLOYEE', payload: form })
    closeModal()
  }

  const handleEdit = form => {
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...form, id: modal.employee.id } })
    closeModal()
  }

  const handleDelete = () => {
    dispatch({ type: 'DELETE_EMPLOYEE', payload: modal.employee.id })
    closeModal()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">{employees.length} producer{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'add' })}>
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* List */}
      {employees.length === 0 ? (
        <div className="card px-6 py-16 text-center text-gray-400">
          <UserPlus size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500">No employees yet</p>
          <p className="text-sm mt-1">Add your first producer to get started.</p>
          <button className="btn-primary mt-4" onClick={() => setModal({ type: 'add' })}>
            <UserPlus size={16} /> Add Employee
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {employees.map(emp => {
            const empPolicies = getEmployeePolicies(emp.id)
            const { rate, renewed, total } = calcRenewalRate(policies, emp.id)
            const bonusRate   = getEmployeeBonusRate(rate)
            const bonusEarned = empPolicies.reduce((sum, p) => sum + (p.bonusAmount ?? 0), 0)
            const clawbacks   = empPolicies
              .filter(p => p.status === 'cancelled' && p.clawbackAmount)
              .reduce((sum, p) => sum + (p.clawbackAmount ?? 0), 0)
            const policyCount = empPolicies.filter(p => p.status !== 'cancelled').length

            return (
              <div key={emp.id} className="card p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-navy-700 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {emp.title && <span>{emp.title} · </span>}
                          {emp.email && <span>{emp.email}</span>}
                          {emp.phone && <span> · {emp.phone}</span>}
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/policies?employee=${emp.id}`}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          <FileText size={13} /> Policies
                        </Link>
                        <button
                          onClick={() => setModal({ type: 'edit', employee: emp })}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', employee: emp })}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500">Policies</p>
                        <p className="text-lg font-bold text-gray-900">{policyCount}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500">Renewals</p>
                        <p className="text-lg font-bold text-gray-900">
                          {total > 0 ? `${renewed}/${total}` : '—'}
                        </p>
                      </div>
                      <div className={`rounded-lg p-2.5 ${rate === null ? 'bg-gray-50' : rate > 0.80 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <p className="text-xs text-gray-500">Renewal Rate</p>
                        <p className={`text-lg font-bold ${rate === null ? 'text-gray-400' : rate > 0.80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {fmtPct(rate)}
                        </p>
                      </div>
                      <div className={`rounded-lg p-2.5 ${bonusRate === null ? 'bg-gray-50' : bonusRate === 0.10 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <p className="text-xs text-gray-500">Bonus Rate</p>
                        <p className={`text-lg font-bold ${bonusRate === null ? 'text-gray-400' : bonusRate === 0.10 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {bonusRate !== null ? fmtPct(bonusRate, 0) : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-500">Net Bonus</p>
                        <p className="text-lg font-bold text-gray-900">{fmt$(bonusEarned - clawbacks)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
          <DeleteConfirm
            employee={modal.employee}
            policyCount={getEmployeePolicies(modal.employee.id).length}
            onConfirm={handleDelete}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </div>
  )
}
