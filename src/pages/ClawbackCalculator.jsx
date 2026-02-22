import React, { useState, useMemo } from 'react'
import { Calculator, RefreshCw, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  calcClawbackManual, calcCancellationClawback,
  calcEndorsementAdjustment, getCurrentPremium,
  getEmployeeBonusRate, calcRenewalRate,
  fmt$, fmtPct, fmtDate, today,
  BONUS_RATE_LOW,
} from '../utils/calculations'

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pctElapsed, pctRemaining }) {
  const ep = Math.round(Math.min(100, pctElapsed  * 100))
  const rp = Math.round(Math.min(100, pctRemaining * 100))
  return (
    <div>
      <div className="timeline-bar">
        <div className="timeline-elapsed flex items-center justify-center text-white text-xs font-bold"
             style={{ width: `${ep}%` }}>
          {ep > 10 ? `${ep}%` : ''}
        </div>
        <div className="timeline-remaining flex items-center justify-center text-white text-xs font-bold"
             style={{ width: `${rp}%` }}>
          {rp > 10 ? `${rp}%` : ''}
        </div>
      </div>
      <div className="flex justify-between text-xs mt-1.5">
        <span className="text-emerald-700 font-medium">{ep}% elapsed — kept</span>
        <span className="text-red-600 font-medium">{rp}% remaining — clawed back</span>
      </div>
    </div>
  )
}

// ── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({ result, policy = null, policyEndorsements = [] }) {
  const {
    baseBonus, adjustments = [], totalAdjustments = 0, netBonus,
    clawbackAmount, netAfterClawback,
    pctElapsed, pctRemaining, daysElapsed, daysRemaining, totalDays,
    bonusAmount,
  } = result

  const displayBase  = baseBonus  ?? bonusAmount  ?? 0
  const displayNet   = netBonus   ?? bonusAmount  ?? 0
  const displayClaw  = clawbackAmount ?? 0
  const displayFinal = netAfterClawback ?? 0

  return (
    <div className="space-y-5 pt-4 border-t border-slate-100">

      {/* Timeline */}
      <div>
        {policy && (
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{fmtDate(policy.effectiveDate)}</span>
            <span>{fmtDate(policy.expirationDate)}</span>
          </div>
        )}
        <ProgressBar pctElapsed={pctElapsed} pctRemaining={pctRemaining} />
      </div>

      {/* Days */}
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Total Term</p>
          <p className="text-xl font-bold text-slate-900">{totalDays}</p>
          <p className="text-xs text-slate-400">days</p>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-xs text-emerald-600 mb-1">Days Elapsed</p>
          <p className="text-xl font-bold text-emerald-700">{daysElapsed}</p>
          <p className="text-xs text-emerald-500">kept</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-500 mb-1">Days Remaining</p>
          <p className="text-xl font-bold text-red-600">{daysRemaining}</p>
          <p className="text-xs text-red-400">clawed back</p>
        </div>
      </div>

      {/* Endorsement adjustments (if any) */}
      {adjustments.length > 0 && (
        <div>
          <p className="section-title mb-2">Endorsement Adjustments</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Premium Change</th>
                  <th>Remaining</th>
                  <th className="text-right th-amber">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj, i) => (
                  <tr key={i}>
                    <td>{fmtDate(adj.endorsementDate)}</td>
                    <td>
                      {fmt$(adj.previousPremium)} <ArrowRight size={11} className="inline text-slate-400" /> {fmt$(adj.newPremium)}
                      <span className={`ml-1 text-xs font-semibold ${adj.isIncrease ? 'text-emerald-600' : 'text-red-600'}`}>
                        ({adj.isIncrease ? '+' : ''}{fmt$(adj.premiumChange)})
                      </span>
                    </td>
                    <td>{fmtPct(adj.pctRemaining)} · {adj.daysRemaining}d</td>
                    <td className={`text-right font-semibold ${adj.isIncrease ? 'td-adj-pos' : 'td-adj-neg'}`}>
                      {adj.isIncrease ? '+' : ''}{fmt$(adj.adjustment)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formula */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
        <p className="section-title mb-2">Clawback Formula</p>
        {totalAdjustments !== 0 && (
          <p className="text-slate-600 mb-1">
            Net Bonus = Base {fmt$(displayBase)} + Adjustments {totalAdjustments >= 0 ? '+' : ''}{fmt$(totalAdjustments)} = <strong>{fmt$(displayNet)}</strong>
          </p>
        )}
        <p className="font-mono text-xs text-slate-500 mb-1">Clawback = Net Bonus × (Days Remaining ÷ Total Term Days)</p>
        <p className="text-slate-800 font-semibold">
          = {fmt$(displayNet)} × ({daysRemaining} ÷ {totalDays}) = <span className="text-red-700">−{fmt$(displayClaw)}</span>
        </p>
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Net Bonus</p>
          <p className="text-2xl font-bold text-emerald-800">{fmt$(displayNet)}</p>
        </div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">Clawback</p>
          <p className="text-2xl font-bold text-red-800">−{fmt$(displayClaw)}</p>
          <p className="text-xs text-red-400 mt-0.5">{Math.round(pctRemaining * 100)}% of net bonus</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-1">Final Payout</p>
          <p className="text-2xl font-bold text-blue-800">{fmt$(displayFinal)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const emptyManual = { bonusAmount: '', effectiveDate: '', expirationDate: '', cancellationDate: today() }

export default function ClawbackCalculator() {
  const { state, getPolicyEndorsements } = useApp()
  const { employees, policies } = state

  const [mode, setMode]             = useState('manual')
  const [selectedPolicyId, setPolicyId] = useState('')
  const [cancelDate, setCancelDate] = useState(today())
  const [manual, setManual]         = useState(emptyManual)
  const setM = k => e => setManual(m => ({ ...m, [k]: e.target.value }))

  // Policies that have a bonus (can show clawback)
  const bonusPolicies = useMemo(() =>
    policies.filter(p => p.netBonus != null),
    [policies]
  )

  const selectedPolicy  = bonusPolicies.find(p => p.id === selectedPolicyId)
  const policyEndorsements = selectedPolicy ? getPolicyEndorsements(selectedPolicy.id) : []

  const getEmpBonusRate = empId => {
    const { rate } = calcRenewalRate(policies, empId)
    return getEmployeeBonusRate(rate) ?? BONUS_RATE_LOW
  }

  // Policy mode result
  const policyResult = useMemo(() => {
    if (!selectedPolicy || !cancelDate) return null
    if (cancelDate <= selectedPolicy.effectiveDate || cancelDate >= selectedPolicy.expirationDate) return null
    try {
      return calcCancellationClawback(
        selectedPolicy, policyEndorsements, cancelDate,
        getEmpBonusRate(selectedPolicy.employeeId)
      )
    } catch { return null }
  }, [selectedPolicy, policyEndorsements, cancelDate, policies])

  // Manual mode result
  const manualResult = useMemo(() => {
    const { bonusAmount, effectiveDate, expirationDate, cancellationDate } = manual
    if (!bonusAmount || !effectiveDate || !expirationDate || !cancellationDate) return null
    const ba = parseFloat(bonusAmount)
    if (!ba || ba <= 0) return null
    if (cancellationDate <= effectiveDate || cancellationDate >= expirationDate) return null
    try { return calcClawbackManual({ bonusAmount: ba, effectiveDate, expirationDate, cancellationDate }) }
    catch { return null }
  }, [manual])

  const getEmpName = id => employees.find(e => e.id === id)?.name ?? '—'

  const manualComplete =
    manual.bonusAmount && manual.effectiveDate && manual.expirationDate && manual.cancellationDate

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calculator size={22} className="text-navy-700" /> Clawback Calculator
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Calculate prorated bonus clawback when a policy is cancelled mid-term.
          Includes endorsement adjustments.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="card p-1 flex gap-1">
        {['manual', 'policy'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === m ? 'bg-navy-700 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {m === 'manual' ? 'Manual Entry' : `From Existing Policy (${bonusPolicies.length})`}
          </button>
        ))}
      </div>

      {/* ── Manual Mode ───────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Enter Policy Details</h2>

          <div>
            <label className="label">Net Bonus Amount Earned ($) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input className="input pl-6" type="number" min="0" step="0.01"
                value={manual.bonusAmount} onChange={setM('bonusAmount')} placeholder="0.00" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Enter net bonus after any endorsement adjustments have been applied.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Policy Effective *</label>
              <input className="input" type="date" value={manual.effectiveDate} onChange={setM('effectiveDate')} />
            </div>
            <div>
              <label className="label">Policy Expiration *</label>
              <input className="input" type="date" value={manual.expirationDate} onChange={setM('expirationDate')} />
            </div>
            <div>
              <label className="label">Cancellation Date *</label>
              <input className="input" type="date" value={manual.cancellationDate} onChange={setM('cancellationDate')} />
            </div>
          </div>

          {/* Quick rate reference */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="section-title mb-2">Bonus Rate Reference</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                <p className="font-bold text-emerald-700">10%</p>
                <p className="text-slate-500">Renewal rate &gt; 80%</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                <p className="font-bold text-amber-700">8%</p>
                <p className="text-slate-500">Renewal rate ≤ 80%</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                <p className="font-bold text-yellow-700">2%</p>
                <p className="text-slate-500">Great West override</p>
              </div>
            </div>
          </div>

          {manualComplete && !manualResult && (
            <p className="text-xs text-red-600">
              Cancellation date must be between effective and expiration dates.
            </p>
          )}

          {manualResult && <ResultPanel result={manualResult} />}

          <button onClick={() => setManual(emptyManual)} className="btn btn-secondary text-xs">
            <RefreshCw size={12} /> Reset
          </button>
        </div>
      )}

      {/* ── Policy Mode ───────────────────────────────────────────────────── */}
      {mode === 'policy' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Select an Existing Policy</h2>

          {bonusPolicies.length === 0 ? (
            <div className="empty-state py-10">
              <Calculator size={36} className="mb-3 opacity-20" />
              <p className="text-sm text-slate-500">No renewed policies with bonus amounts yet.</p>
              <p className="text-xs text-slate-400 mt-1">Mark policies as renewed in the Policies page first.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Policy *</label>
                <select className="input" value={selectedPolicyId} onChange={e => setPolicyId(e.target.value)}>
                  <option value="">Choose a policy…</option>
                  {bonusPolicies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.insuredName || p.policyNumber} — {p.carrier} — Net Bonus: {fmt$(p.netBonus)} ({getEmpName(p.employeeId)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPolicy && (
                <>
                  {/* Policy summary */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Insured:</span> <strong>{selectedPolicy.insuredName || '—'}</strong></div>
                    <div><span className="text-slate-500">Carrier:</span> <strong>{selectedPolicy.carrier}</strong></div>
                    <div><span className="text-slate-500">Effective:</span> <strong>{fmtDate(selectedPolicy.effectiveDate)}</strong></div>
                    <div><span className="text-slate-500">Expiration:</span> <strong>{fmtDate(selectedPolicy.expirationDate)}</strong></div>
                    <div>
                      <span className="text-slate-500">Current Premium:</span>{' '}
                      <strong>{fmt$(getCurrentPremium(selectedPolicy, policyEndorsements))}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Net Bonus:</span>{' '}
                      <strong className="text-emerald-700">{fmt$(selectedPolicy.netBonus)}</strong>
                      {selectedPolicy.adjustmentTotal !== 0 && (
                        <span className={`ml-1 text-xs ${(selectedPolicy.adjustmentTotal ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          (Base {fmt$(selectedPolicy.bonusAmount)} + Adj {(selectedPolicy.adjustmentTotal ?? 0) >= 0 ? '+' : ''}{fmt$(selectedPolicy.adjustmentTotal)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Endorsement list */}
                  {policyEndorsements.length > 0 && (
                    <div>
                      <p className="section-title mb-2">Endorsements on this policy ({policyEndorsements.length})</p>
                      <div className="space-y-1">
                        {policyEndorsements.map((e, i) => {
                          const adj = calcEndorsementAdjustment(selectedPolicy, e, getEmpBonusRate(selectedPolicy.employeeId))
                          return (
                            <div key={i} className={`flex items-center gap-3 text-xs p-2 rounded ${adj.isIncrease ? 'bg-emerald-50' : 'bg-red-50'}`}>
                              <span className="text-slate-500 w-20">{fmtDate(e.endorsementDate)}</span>
                              <span>{fmt$(e.previousPremium)} → {fmt$(e.newPremium)}</span>
                              <span className={`ml-auto font-bold ${adj.isIncrease ? 'text-emerald-700' : 'text-red-700'}`}>
                                {adj.isIncrease ? '+' : ''}{fmt$(adj.adjustment)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label">Cancellation Date *</label>
                    <input className="input" type="date"
                      min={selectedPolicy.effectiveDate}
                      max={selectedPolicy.expirationDate}
                      value={cancelDate} onChange={e => setCancelDate(e.target.value)} />
                    {cancelDate && (cancelDate <= selectedPolicy.effectiveDate || cancelDate >= selectedPolicy.expirationDate) && (
                      <p className="field-error">Date must be between effective and expiration dates</p>
                    )}
                  </div>

                  {policyResult && (
                    <ResultPanel result={policyResult} policy={selectedPolicy} policyEndorsements={policyEndorsements} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Reference card */}
      <div className="card p-5">
        <p className="section-title mb-3">Clawback Rules</p>
        <div className="text-sm text-slate-700 space-y-1.5">
          <p><strong>Net Bonus</strong> = Base Renewal Bonus + Σ(Endorsement Adjustments)</p>
          <p><strong>Clawback</strong> = Net Bonus × (Days Remaining ÷ Total Term Days)</p>
          <p><strong>Final Payout</strong> = Net Bonus − Clawback</p>
          <div className="divider" />
          <p className="text-slate-500">Example: Policy cancelled at 50% of term → 50% of net bonus clawed back</p>
          <p className="text-slate-500">Example: Premium decreases mid-term → chargeback reduces net bonus first, then remaining net bonus is used for cancellation clawback</p>
        </div>
      </div>
    </div>
  )
}
