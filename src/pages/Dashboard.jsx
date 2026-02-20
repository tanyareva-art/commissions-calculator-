import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, FileText, DollarSign, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { calcRenewalRate, getEmployeeBonusRate, fmt$, fmtPct, RENEWAL_TYPES } from '../utils/calculations'

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    navy:   'bg-navy-50 text-navy-700',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function RenewalBar({ rate }) {
  if (rate === null) return <span className="text-gray-400 text-sm">No renewals</span>
  const pct = Math.round(rate * 100)
  const color = rate > 0.80 ? 'bg-emerald-500' : 'bg-amber-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  )
}

export default function Dashboard() {
  const { state } = useApp()
  const { employees, policies } = state

  const stats = useMemo(() => {
    const activePolicies   = policies.filter(p => p.status === 'active' || p.status === 'renewed').length
    const totalBonusEarned = policies.reduce((sum, p) => sum + (p.bonusAmount ?? 0), 0)
    const totalClawback    = policies
      .filter(p => p.status === 'cancelled' && p.clawbackAmount)
      .reduce((sum, p) => sum + (p.clawbackAmount ?? 0), 0)
    const pendingRenewals  = policies.filter(p =>
      RENEWAL_TYPES.includes(p.type) && !p.firstPaymentDate && p.status !== 'cancelled' && p.status !== 'lost'
    ).length

    return { activePolicies, totalBonusEarned, totalClawback, pendingRenewals }
  }, [policies])

  const employeeRows = useMemo(() => {
    return employees.map(emp => {
      const { rate, renewed, total } = calcRenewalRate(policies, emp.id)
      const bonusRate    = getEmployeeBonusRate(rate)
      const bonusEarned  = policies
        .filter(p => p.employeeId === emp.id && p.bonusAmount)
        .reduce((sum, p) => sum + (p.bonusAmount ?? 0), 0)
      const pendingClaw  = policies
        .filter(p => p.employeeId === emp.id && p.status === 'cancelled' && p.clawbackAmount)
        .reduce((sum, p) => sum + (p.clawbackAmount ?? 0), 0)
      const policyCount  = policies.filter(p => p.employeeId === emp.id && p.status !== 'cancelled').length
      return { emp, rate, renewed, total, bonusRate, bonusEarned, pendingClaw, policyCount }
    })
  }, [employees, policies])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Agency-wide commission overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Employees"         value={employees.length}           color="blue"   />
        <StatCard icon={FileText}      label="Active Policies"   value={stats.activePolicies}       color="navy"   />
        <StatCard icon={DollarSign}    label="Total Bonus Earned" value={fmt$(stats.totalBonusEarned)} color="green"  />
        <StatCard icon={AlertTriangle} label="Total Clawback"    value={fmt$(stats.totalClawback)}  color="red"
          sub={stats.pendingRenewals > 0 ? `${stats.pendingRenewals} renewals pending` : undefined}
        />
      </div>

      {/* Employee performance table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={16} className="text-navy-700" />
            Employee Performance
          </h2>
          <Link to="/employees" className="text-xs text-navy-700 hover:underline flex items-center gap-1">
            Manage <ArrowRight size={12} />
          </Link>
        </div>

        {employees.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No employees yet.</p>
            <Link to="/employees" className="mt-2 inline-block text-sm text-navy-700 hover:underline">
              Add your first employee →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-center">Policies</th>
                  <th className="px-4 py-3 text-center">Renewals</th>
                  <th className="px-4 py-3 text-left min-w-[160px]">Renewal Rate</th>
                  <th className="px-4 py-3 text-center">Bonus Rate</th>
                  <th className="px-4 py-3 text-right">Bonus Earned</th>
                  <th className="px-4 py-3 text-right">Clawbacks</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employeeRows.map(({ emp, rate, renewed, total, bonusRate, bonusEarned, pendingClaw, policyCount }) => {
                  const net = bonusEarned - pendingClaw
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{emp.name}</div>
                        {emp.email && <div className="text-xs text-gray-400">{emp.email}</div>}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">{policyCount}</td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {total > 0 ? `${renewed} / ${total}` : '—'}
                      </td>
                      <td className="px-4 py-4 min-w-[160px]">
                        <RenewalBar rate={rate} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        {bonusRate !== null ? (
                          <span className={`font-bold ${bonusRate === 0.10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {fmtPct(bonusRate, 0)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-emerald-700">{fmt$(bonusEarned)}</td>
                      <td className="px-4 py-4 text-right font-medium text-red-600">
                        {pendingClaw > 0 ? `-${fmt$(pendingClaw)}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">{fmt$(net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bonus rate rules reminder */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bonus Rate Rules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-base flex-shrink-0">10%</div>
            <div>
              <p className="font-medium text-emerald-800">High Tier</p>
              <p className="text-xs text-emerald-700">Renewal rate &gt; 80%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-base flex-shrink-0">8%</div>
            <div>
              <p className="font-medium text-amber-800">Standard Tier</p>
              <p className="text-xs text-amber-700">Renewal rate ≤ 80%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-base flex-shrink-0">2%</div>
            <div>
              <p className="font-medium text-blue-800">Great West</p>
              <p className="text-xs text-blue-700">All Great West policies</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
