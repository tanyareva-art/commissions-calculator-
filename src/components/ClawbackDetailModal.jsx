import React from 'react'
import Modal from './Modal'
import { fmt$, fmtPct, fmtDate } from '../utils/calculations'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

/**
 * ClawbackDetailModal
 *
 * Displays the full prorated clawback breakdown for a cancelled policy,
 * including base bonus, endorsement adjustments, net bonus, and clawback formula.
 *
 * Props:
 *   result        – return value of calcCancellationClawback(...)
 *   policy        – the policy object
 *   cancellationDate – YYYY-MM-DD string
 *   onClose       – () => void
 */
export default function ClawbackDetailModal({ result, policy, cancellationDate, onClose }) {
  if (!result) return null

  const {
    baseBonus, adjustments, totalAdjustments, netBonus,
    clawbackAmount, netAfterClawback,
    pctElapsed, pctRemaining, daysElapsed, daysRemaining, totalDays,
  } = result

  const elapsedPct  = Math.round(pctElapsed  * 100)
  const remainPct   = Math.round(pctRemaining * 100)

  return (
    <Modal title="Clawback Detail" onClose={onClose} size="lg">
      {/* Policy header */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-5 p-3 bg-slate-50 rounded-lg">
        <span><span className="text-slate-500">Insured:</span> <strong>{policy.insuredName || '—'}</strong></span>
        <span><span className="text-slate-500">Carrier:</span> <strong>{policy.carrier}</strong></span>
        <span><span className="text-slate-500">Effective:</span> <strong>{fmtDate(policy.effectiveDate)}</strong></span>
        <span><span className="text-slate-500">Expiration:</span> <strong>{fmtDate(policy.expirationDate)}</strong></span>
        <span><span className="text-slate-500">Cancelled:</span> <strong className="text-red-700">{fmtDate(cancellationDate)}</strong></span>
      </div>

      {/* ── Step 1: Base Bonus ───────────────────────────────────── */}
      <div className="section-title mb-2">Step 1 — Base Renewal Bonus</div>
      <div className="p-3 rounded-lg border border-slate-200 text-sm mb-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">
            Renewal premium <strong>{fmt$(policy.renewalPremium ?? policy.premium)}</strong>
            {' '}× rate <strong>{fmtPct(policy.bonusRate, 0)}</strong>
          </span>
          <span className="td-bonus text-base">{fmt$(baseBonus)}</span>
        </div>
      </div>

      {/* ── Step 2: Endorsement Adjustments ─────────────────────── */}
      <div className="section-title mb-2">Step 2 — Endorsement Adjustments</div>
      {adjustments.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4 pl-1">No endorsements on this policy.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 text-sm">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Premium Change</th>
                <th>Remaining Term</th>
                <th className="text-right th-amber">Adjustment</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj, i) => (
                <tr key={i}>
                  <td>{fmtDate(adj.endorsementDate)}</td>
                  <td>
                    <span className="text-slate-500">{fmt$(adj.previousPremium)}</span>
                    {' '}<ArrowRight size={12} className="inline text-slate-400" />{' '}
                    <span className="font-medium">{fmt$(adj.newPremium)}</span>
                    {' '}
                    <span className={adj.isIncrease ? 'text-emerald-600' : 'text-red-600'}>
                      ({adj.isIncrease ? '+' : ''}{fmt$(adj.premiumChange)})
                    </span>
                  </td>
                  <td>{fmtPct(adj.pctRemaining)} ({adj.daysRemaining} days)</td>
                  <td className={`text-right ${adj.isIncrease ? 'td-adj-pos' : 'td-adj-neg'}`}>
                    {adj.isIncrease ? '+' : ''}{fmt$(adj.adjustment)}
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-50 font-semibold">
                <td colSpan={3} className="text-amber-800">Total Endorsement Adjustments</td>
                <td className={`text-right ${totalAdjustments >= 0 ? 'td-adj-pos' : 'td-adj-neg'}`}>
                  {totalAdjustments >= 0 ? '+' : ''}{fmt$(totalAdjustments)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Step 3: Net Bonus ────────────────────────────────────── */}
      <div className="section-title mb-2">Step 3 — Net Bonus</div>
      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm mb-4">
        <div className="flex items-center justify-between">
          <span className="text-emerald-800">
            Base Bonus <strong>{fmt$(baseBonus)}</strong>
            {' + '}
            Adjustments <strong>{totalAdjustments >= 0 ? '+' : ''}{fmt$(totalAdjustments)}</strong>
          </span>
          <span className="td-bonus text-lg">{fmt$(netBonus)}</span>
        </div>
      </div>

      {/* ── Step 4: Clawback Proration ───────────────────────────── */}
      <div className="section-title mb-2">Step 4 — Prorated Clawback</div>

      {/* Timeline bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{fmtDate(policy.effectiveDate)}</span>
          <span className="font-medium text-red-600">Cancelled {fmtDate(cancellationDate)}</span>
          <span>{fmtDate(policy.expirationDate)}</span>
        </div>
        <div className="timeline-bar">
          <div className="timeline-elapsed flex items-center justify-center text-white text-[11px] font-bold"
               style={{ width: `${Math.min(100, elapsedPct)}%` }}>
            {elapsedPct > 12 ? `${elapsedPct}%` : ''}
          </div>
          <div className="timeline-remaining flex items-center justify-center text-white text-[11px] font-bold"
               style={{ width: `${Math.min(100, remainPct)}%` }}>
            {remainPct > 12 ? `${remainPct}%` : ''}
          </div>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-emerald-700 font-medium">{daysElapsed} days elapsed (kept)</span>
          <span className="text-red-600 font-medium">{daysRemaining} days remaining (clawed back)</span>
        </div>
      </div>

      {/* Formula */}
      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm mb-4">
        <p className="font-mono text-red-800 text-xs mb-1 font-bold">FORMULA</p>
        <p className="text-red-700">
          Clawback = Net Bonus × (Days Remaining ÷ Total Term Days)
        </p>
        <p className="text-red-900 font-semibold mt-1">
          = {fmt$(netBonus)} × ({daysRemaining} ÷ {totalDays}) = <strong>{fmt$(clawbackAmount)}</strong>
        </p>
      </div>

      {/* ── Final Summary ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Net Bonus</p>
          <p className="text-xl font-bold text-emerald-800">{fmt$(netBonus)}</p>
        </div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">Clawback</p>
          <p className="text-xl font-bold text-red-800">−{fmt$(clawbackAmount)}</p>
          <p className="text-xs text-red-500">{remainPct}% of net bonus</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-1">Final Payout</p>
          <p className="text-xl font-bold text-blue-800">{fmt$(netAfterClawback)}</p>
        </div>
      </div>
    </Modal>
  )
}
