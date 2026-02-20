import React, { useState, useMemo } from 'react'
import { Calculator, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { calcClawbackManual, calcClawback, fmt$, fmtPct, fmtDate, today } from '../utils/calculations'

const emptyManual = {
  bonusAmount: '',
  effectiveDate: '',
  expirationDate: '',
  cancellationDate: today(),
}

function ProgressBar({ pctElapsed, pctRemaining }) {
  const elapsedPct  = Math.min(100, Math.round(pctElapsed  * 100))
  const remainPct   = Math.min(100, Math.round(pctRemaining * 100))
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Policy Start</span>
        <span>Cancellation</span>
        <span>Policy End</span>
      </div>
      <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-emerald-400 flex items-center justify-center text-white text-xs font-semibold"
          style={{ width: `${elapsedPct}%` }}
        >
          {elapsedPct > 8 ? `${elapsedPct}%` : ''}
        </div>
        <div
          className="h-full bg-red-400 flex items-center justify-center text-white text-xs font-semibold"
          style={{ width: `${remainPct}%` }}
        >
          {remainPct > 8 ? `${remainPct}%` : ''}
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-emerald-700 font-medium">Earned ({elapsedPct}% of term)</span>
        <span className="text-red-600 font-medium">Clawback ({remainPct}% of term)</span>
      </div>
    </div>
  )
}

function ResultPanel({ result, label = 'Cancellation Date' }) {
  return (
    <div className="space-y-5">
      {/* Timeline bar */}
      <ProgressBar pctElapsed={result.pctElapsed} pctRemaining={result.pctRemaining} />

      {/* Days breakdown */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total Term</p>
          <p className="text-xl font-bold text-gray-900">{result.totalDays}</p>
          <p className="text-xs text-gray-400">days</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Days Elapsed</p>
          <p className="text-xl font-bold text-emerald-700">{result.daysElapsed}</p>
          <p className="text-xs text-emerald-600">kept</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Days Remaining</p>
          <p className="text-xl font-bold text-red-600">{result.daysRemaining}</p>
          <p className="text-xs text-red-400">clawed back</p>
        </div>
      </div>

      {/* Money breakdown */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Bonus Earned</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt$(result.bonusEarned ?? result.bonusAmount)}</p>
          </div>
          <div className="p-4 text-center bg-red-50">
            <p className="text-xs text-red-500 uppercase tracking-wide">Clawback Amount</p>
            <p className="text-2xl font-bold text-red-600 mt-1">-{fmt$(result.clawbackAmount)}</p>
            <p className="text-xs text-red-400 mt-0.5">{Math.round(result.pctRemaining * 100)}% of bonus</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Net Bonus Kept</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt$(result.netBonus)}</p>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono">
        <p className="font-sans text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Formula</p>
        <p>Clawback = Bonus × (Days Remaining ÷ Total Term Days)</p>
        <p className="mt-1 text-gray-500">
          = {fmt$(result.bonusEarned ?? result.bonusAmount)} × ({result.daysRemaining} ÷ {result.totalDays})
          = <strong className="text-red-600">{fmt$(result.clawbackAmount)}</strong>
        </p>
      </div>
    </div>
  )
}

export default function ClawbackCalculator() {
  const { state } = useApp()
  const { employees, policies } = state

  const [mode, setMode] = useState('manual') // 'manual' | 'policy'
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [cancelDate, setCancelDate] = useState(today())
  const [manual, setManual] = useState(emptyManual)
  const setM = k => e => setManual(m => ({ ...m, [k]: e.target.value }))

  // Policies that have a bonus (can clawback)
  const bonusPolicies = useMemo(() =>
    policies.filter(p => p.bonusAmount != null && p.status !== 'cancelled'),
    [policies]
  )

  const selectedPolicy = useMemo(() =>
    bonusPolicies.find(p => p.id === selectedPolicyId),
    [bonusPolicies, selectedPolicyId]
  )

  // Policy mode result
  const policyResult = useMemo(() => {
    if (!selectedPolicy || !cancelDate) return null
    try { return calcClawback(selectedPolicy, cancelDate) } catch { return null }
  }, [selectedPolicy, cancelDate])

  // Manual mode result
  const manualResult = useMemo(() => {
    const { bonusAmount, effectiveDate, expirationDate, cancellationDate } = manual
    if (!bonusAmount || !effectiveDate || !expirationDate || !cancellationDate) return null
    if (new Date(cancellationDate) <= new Date(effectiveDate)) return null
    if (new Date(cancellationDate) >= new Date(expirationDate)) return null
    try {
      return calcClawbackManual({
        bonusAmount: parseFloat(bonusAmount),
        effectiveDate,
        expirationDate,
        cancellationDate,
      })
    } catch { return null }
  }, [manual])

  const getEmpName = id => employees.find(e => e.id === id)?.name ?? '—'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator size={24} className="text-navy-700" /> Clawback Calculator
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Calculate prorated bonus clawback when a policy is cancelled mid-term.
        </p>
      </div>

      {/* Mode selector */}
      <div className="card p-1 flex gap-1">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'manual' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setMode('policy')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'policy' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          From Existing Policy ({bonusPolicies.length})
        </button>
      </div>

      {/* Manual Mode */}
      {mode === 'manual' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Enter Policy Details</h2>

          <div>
            <label className="label">Bonus Amount Earned ($) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                className="input pl-7"
                type="number" min="0" step="0.01"
                value={manual.bonusAmount}
                onChange={setM('bonusAmount')}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Not sure? Calculate: Premium × Bonus% (10%, 8%, or 2% for Great West)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
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

          {/* Quick reference */}
          <div className="bg-navy-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-navy-700 uppercase tracking-wide mb-2">Quick Bonus Reference</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-navy-800">
              <div className="bg-white rounded p-2">
                <p className="font-bold">10% — High Tier</p>
                <p className="text-gray-500">Renewal rate &gt;80%</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="font-bold">8% — Standard</p>
                <p className="text-gray-500">Renewal rate ≤80%</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="font-bold">2% — Great West</p>
                <p className="text-gray-500">GW carrier override</p>
              </div>
            </div>
          </div>

          {/* Result */}
          {manualResult ? (
            <div className="pt-2 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Clawback Calculation</h3>
              <ResultPanel result={manualResult} />
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-sm border-t border-gray-100">
              Fill in all fields above to see the clawback calculation.
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => setManual(emptyManual)}
            className="btn-secondary text-xs"
          >
            <RefreshCw size={12} /> Reset
          </button>
        </div>
      )}

      {/* Policy Mode */}
      {mode === 'policy' && (
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Select an Existing Policy</h2>

          {bonusPolicies.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Calculator size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No renewed policies with bonus amounts yet.</p>
              <p className="text-xs mt-1">Mark policies as renewed in the Policies page first.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Select Policy *</label>
                <select className="input" value={selectedPolicyId} onChange={e => setSelectedPolicyId(e.target.value)}>
                  <option value="">Choose a policy…</option>
                  {bonusPolicies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.insuredName || p.policyNumber} — {p.carrier} — Bonus: {fmt$(p.bonusAmount)} ({getEmpName(p.employeeId)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPolicy && (
                <>
                  {/* Policy summary */}
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Insured:</span>{' '}
                      <span className="font-medium">{selectedPolicy.insuredName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Carrier:</span>{' '}
                      <span className="font-medium">{selectedPolicy.carrier}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Effective:</span>{' '}
                      <span className="font-medium">{fmtDate(selectedPolicy.effectiveDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expiration:</span>{' '}
                      <span className="font-medium">{fmtDate(selectedPolicy.expirationDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Renewal Premium:</span>{' '}
                      <span className="font-medium">{fmt$(selectedPolicy.renewalPremium ?? selectedPolicy.premium)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bonus Earned:</span>{' '}
                      <span className="font-semibold text-emerald-700">{fmt$(selectedPolicy.bonusAmount)}</span>
                      {' '}<span className="text-gray-400 text-xs">({fmtPct(selectedPolicy.bonusRate, 0)} rate)</span>
                    </div>
                  </div>

                  <div>
                    <label className="label">Cancellation Date *</label>
                    <input
                      className="input"
                      type="date"
                      value={cancelDate}
                      min={selectedPolicy.effectiveDate}
                      max={selectedPolicy.expirationDate}
                      onChange={e => setCancelDate(e.target.value)}
                    />
                  </div>

                  {policyResult && (
                    <div className="pt-2 border-t border-gray-100">
                      <h3 className="font-semibold text-gray-900 mb-4">Clawback Calculation</h3>
                      <ResultPanel result={policyResult} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Reference card */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Clawback Rule</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <p><strong>Formula:</strong> Clawback = Bonus Earned × (Days Remaining ÷ Total Term Days)</p>
          <p className="text-gray-500">Example: Cancelled at 50% of term → 50% of bonus is clawed back</p>
          <p className="text-gray-500">Example: Cancelled at 25% of term → 75% of bonus is clawed back</p>
        </div>
      </div>
    </div>
  )
}
