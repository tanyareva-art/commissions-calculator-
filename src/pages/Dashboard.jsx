import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, DollarSign, ArrowDownCircle, Banknote, ArrowRight, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  calcRenewalRate, getEmployeeBonusRate,
  fmt$, fmtPct, fmtMonthYear,
  RENEWAL_TYPES,
} from '../utils/calculations'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthRange(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const start  = new Date(y, m - 1, 1).toISOString().slice(0, 10)
  const end    = new Date(y, m, 0).toISOString().slice(0, 10)
  return { start, end }
}

function inRange(dateStr, range) {
  if (!range || !dateStr) return true
  return dateStr >= range.start && dateStr <= range.end
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }) {
  const palettes = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', val: 'text-emerald-800' },
    red:   { bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-500',     val: 'text-red-700'    },
    blue:  { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-600',    val: 'text-blue-800'   },
    amber: { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   val: 'text-amber-800'  },
  }
  const p = palettes[color] ?? palettes.blue
  return (
    <div className={`card p-5 border ${p.border}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="section-title">{label}</p>
        <div className={`w-9 h-9 rounded-lg ${p.bg} flex items-center justify-center ${p.icon}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${p.val}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Renewal Rate Pill ─────────────────────────────────────────────────────────

function RatePill({ rate }) {
  if (rate === null) return <span className="td-muted text-sm">No data</span>
  const pct    = Math.round(rate * 100)
  const isHigh = rate > 0.80
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${isHigh ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${isHigh ? 'text-emerald-700' : 'text-amber-700'}`}>
        {pct}%
      </span>
    </div>
  )
}

// ── Tier Badge ────────────────────────────────────────────────────────────────

function TierBadge({ rate, bonusRate }) {
  if (bonusRate === null) return <span className="badge badge-gray">No data</span>
  if (bonusRate === 0.10) return <span className="badge badge-green">High Tier · {fmtPct(rate)}</span>
  if (bonusRate === 0.08) return <span className="badge badge-amber">Std Tier · {fmtPct(rate)}</span>
  return <span className="badge badge-yellow">GW Override</span>
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { state } = useApp()
  const { employees, policies, endorsements } = state

  const [filterMonth, setFilterMonth] = useState('')   // '' = all time, 'YYYY-MM' for a specific month

  // Available month options derived from policy dates
  const availableMonths = useMemo(() => {
    const months = new Set()
    policies.forEach(p => {
      if (p.expirationDate) {
        months.add(p.expirationDate.slice(0, 7))
      }
      if (p.firstPaymentDate) {
        months.add(p.firstPaymentDate.slice(0, 7))
      }
    })
    return [...months].sort().reverse()
  }, [policies])

  const range = useMemo(() => filterMonth ? getMonthRange(filterMonth) : null, [filterMonth])

  // ── Agency-wide summary ──────────────────────────────────────────────────
  const summary = useMemo(() => {
    // Renewal rate: policies expiring in range
    const eligible  = policies.filter(p =>
      RENEWAL_TYPES.includes(p.type) &&
      !(p.status === 'cancelled' && !p.firstPaymentDate) &&
      (!range || inRange(p.expirationDate, range))
    )
    const renewed   = eligible.filter(p => !!p.firstPaymentDate).length
    const renewRate = eligible.length > 0 ? renewed / eligible.length : null

    // Bonus: policies with firstPaymentDate in range
    const bonusPolicies = policies.filter(p =>
      p.netBonus != null && (!range || inRange(p.firstPaymentDate, range))
    )
    const totalBonus    = bonusPolicies.reduce((s, p) => s + (p.netBonus ?? 0), 0)
    const totalBase     = bonusPolicies.reduce((s, p) => s + (p.bonusAmount ?? 0), 0)
    const totalAdj      = bonusPolicies.reduce((s, p) => s + (p.adjustmentTotal ?? 0), 0)

    // Clawbacks: cancelled in range
    const cancelledPols = policies.filter(p =>
      p.status === 'cancelled' && p.clawbackAmount != null &&
      (!range || inRange(p.cancellationDate, range))
    )
    const totalClawback = cancelledPols.reduce((s, p) => s + (p.clawbackAmount ?? 0), 0)

    const netPayout = totalBonus - totalClawback

    return {
      renewRate, renewed, total: eligible.length,
      totalBonus, totalBase, totalAdj,
      totalClawback,
      netPayout,
    }
  }, [policies, range])

  // ── Per-employee rows ────────────────────────────────────────────────────
  const empRows = useMemo(() => {
    return employees.map(emp => {
      const { rate, renewed, total } = calcRenewalRate(policies, emp.id, range?.start, range?.end)
      const bonusRate = getEmployeeBonusRate(rate)

      const empPolicies = policies.filter(p => p.employeeId === emp.id)

      const bonusPols = empPolicies.filter(p =>
        p.netBonus != null && (!range || inRange(p.firstPaymentDate, range))
      )
      const baseBonus   = bonusPols.reduce((s, p) => s + (p.bonusAmount    ?? 0), 0)
      const adjTotal    = bonusPols.reduce((s, p) => s + (p.adjustmentTotal ?? 0), 0)
      const netBonus    = bonusPols.reduce((s, p) => s + (p.netBonus        ?? 0), 0)

      const clawPols    = empPolicies.filter(p =>
        p.status === 'cancelled' && p.clawbackAmount != null &&
        (!range || inRange(p.cancellationDate, range))
      )
      const clawbacks   = clawPols.reduce((s, p) => s + (p.clawbackAmount ?? 0), 0)
      const netPayout   = netBonus - clawbacks

      return { emp, rate, renewed, total, bonusRate, baseBonus, adjTotal, netBonus, clawbacks, netPayout }
    })
  }, [employees, policies, range])

  return (
    <div className="space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agency Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filterMonth ? fmtMonthYear(filterMonth) : 'All Time'} · {employees.length} producer{employees.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Month filter */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Month:</label>
          <select
            className="input w-48 text-sm"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          >
            <option value="">All Time</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{fmtMonthYear(m)}</option>
            ))}
          </select>
          {filterMonth && (
            <button className="btn btn-secondary text-xs" onClick={() => setFilterMonth('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Agency Renewal Rate"
          value={summary.renewRate !== null ? fmtPct(summary.renewRate) : '—'}
          sub={summary.total > 0 ? `${summary.renewed} of ${summary.total} policies renewed` : 'No renewal policies'}
          icon={TrendingUp}
          color={summary.renewRate === null ? 'blue' : summary.renewRate > 0.80 ? 'green' : 'amber'}
        />
        <StatCard
          label="Total Bonus Earned"
          value={fmt$(summary.totalBonus)}
          sub={`Base ${fmt$(summary.totalBase)} + Adj ${summary.totalAdj >= 0 ? '+' : ''}${fmt$(summary.totalAdj)}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Total Clawbacks"
          value={summary.totalClawback > 0 ? `−${fmt$(summary.totalClawback)}` : '$0.00'}
          sub="Applied to cancelled policies"
          icon={ArrowDownCircle}
          color={summary.totalClawback > 0 ? 'red' : 'blue'}
        />
        <StatCard
          label="Net Payout"
          value={fmt$(summary.netPayout)}
          sub="Bonus earned minus clawbacks"
          icon={Banknote}
          color="blue"
        />
      </div>

      {/* ── Bonus Rate Rules Reference ────────────────────────────────────── */}
      <div className="card p-4">
        <p className="section-title mb-3">Bonus Rate Tiers</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-lg flex-shrink-0">
              10%
            </div>
            <div>
              <p className="font-semibold text-emerald-800">High Tier</p>
              <p className="text-xs text-emerald-700">Renewal rate &gt; 80%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-lg flex-shrink-0">
              8%
            </div>
            <div>
              <p className="font-semibold text-amber-800">Standard Tier</p>
              <p className="text-xs text-amber-700">Renewal rate ≤ 80%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="w-11 h-11 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-lg flex-shrink-0">
              2%
            </div>
            <div>
              <p className="font-semibold text-yellow-800">Great West</p>
              <p className="text-xs text-yellow-700">Carrier override · always 2%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Employee Performance Table ────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp size={16} className="text-navy-700" /> Employee Performance
          </h2>
          <Link to="/employees" className="text-xs text-navy-700 hover:underline flex items-center gap-1">
            Manage <ArrowRight size={12} />
          </Link>
        </div>

        {employees.length === 0 ? (
          <div className="empty-state">
            <Users size={40} className="mb-3 opacity-20" />
            <p className="font-medium text-slate-500">No employees yet</p>
            <Link to="/employees" className="mt-2 text-sm text-navy-700 hover:underline">
              Add your first producer →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="pl-6">Employee</th>
                  <th className="text-center">Renewals</th>
                  <th>Renewal %</th>
                  <th>Tier Achieved</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right th-green">Base Bonus</th>
                  <th className="text-right th-amber">Endorsement Adj</th>
                  <th className="text-right th-green">Net Bonus</th>
                  <th className="text-right th-red">Clawbacks</th>
                  <th className="text-right th-blue pr-6">Net Payout</th>
                </tr>
              </thead>
              <tbody>
                {empRows.map(({ emp, rate, renewed, total, bonusRate, baseBonus, adjTotal, netBonus, clawbacks, netPayout }) => (
                  <tr key={emp.id}>
                    <td className="pl-6">
                      <Link to={`/policies?employee=${emp.id}`} className="font-semibold text-slate-900 hover:text-navy-700 transition-colors">
                        {emp.name}
                      </Link>
                      {emp.title && <div className="text-xs text-slate-400">{emp.title}</div>}
                    </td>

                    <td className="text-center text-slate-600">
                      {total > 0 ? (
                        <span className="font-medium">{renewed}/{total}</span>
                      ) : <span className="td-muted">—</span>}
                    </td>

                    <td><RatePill rate={rate} /></td>

                    <td><TierBadge rate={rate} bonusRate={bonusRate} /></td>

                    <td className="text-right">
                      {bonusRate !== null ? (
                        <span className={`font-bold text-base ${bonusRate === 0.10 ? 'text-emerald-700' : bonusRate === 0.08 ? 'text-amber-700' : 'text-blue-700'}`}>
                          {fmtPct(bonusRate, 0)}
                        </span>
                      ) : <span className="td-muted">—</span>}
                    </td>

                    <td className="text-right td-bonus">{baseBonus > 0 ? fmt$(baseBonus) : <span className="td-muted">—</span>}</td>

                    <td className="text-right">
                      {adjTotal !== 0 ? (
                        <span className={adjTotal > 0 ? 'td-adj-pos' : 'td-adj-neg'}>
                          {adjTotal > 0 ? '+' : ''}{fmt$(adjTotal)}
                        </span>
                      ) : <span className="td-muted">—</span>}
                    </td>

                    <td className="text-right td-bonus">{netBonus > 0 ? fmt$(netBonus) : <span className="td-muted">—</span>}</td>

                    <td className="text-right td-claw">{clawbacks > 0 ? `−${fmt$(clawbacks)}` : <span className="td-muted">—</span>}</td>

                    <td className="text-right td-net pr-6">{fmt$(netPayout)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              {empRows.length > 1 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
                    <td colSpan={5} className="pl-6 text-slate-600 py-3">Agency Total</td>
                    <td className="text-right td-bonus py-3">
                      {fmt$(empRows.reduce((s, r) => s + r.baseBonus, 0))}
                    </td>
                    <td className="text-right py-3">
                      {(() => {
                        const t = empRows.reduce((s, r) => s + r.adjTotal, 0)
                        return t !== 0
                          ? <span className={t > 0 ? 'td-adj-pos' : 'td-adj-neg'}>{t > 0 ? '+' : ''}{fmt$(t)}</span>
                          : <span className="td-muted">—</span>
                      })()}
                    </td>
                    <td className="text-right td-bonus py-3">
                      {fmt$(empRows.reduce((s, r) => s + r.netBonus, 0))}
                    </td>
                    <td className="text-right td-claw py-3">
                      {(() => {
                        const t = empRows.reduce((s, r) => s + r.clawbacks, 0)
                        return t > 0 ? `−${fmt$(t)}` : <span className="td-muted">—</span>
                      })()}
                    </td>
                    <td className="text-right td-net pr-6 py-3">
                      {fmt$(empRows.reduce((s, r) => s + r.netPayout, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
