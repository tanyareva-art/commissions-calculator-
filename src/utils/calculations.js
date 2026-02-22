/**
 * Commission Calculation Engine
 *
 * Business Rules:
 * 1. No base commission — bonus only.
 * 2. Renewal bonus tiers (applied to each renewed policy's GWP):
 *    - Great West carrier  → 2%  (always, overrides all tiers)
 *    - Other carriers:
 *        employee renewal rate > 80%  → 10% of renewal GWP
 *        employee renewal rate ≤ 80%  → 8%  of renewal GWP
 * 3. "Renewed" = first payment date recorded.
 * 4. Rewrites count as renewals; no employee-to-employee transfers.
 * 5. Endorsements:
 *    - Premium increase → positive bonus adjustment (prorated for remaining term)
 *    - Premium decrease → negative adjustment / chargeback (prorated)
 *    - Formula: (newPremium − prevPremium) × rate × (daysRemaining ÷ totalTermDays)
 * 6. Cancellation clawback applied to NET bonus (base + all adjustments):
 *    Clawback = Net Bonus × (daysRemaining ÷ totalTermDays)
 */

export const GREAT_WEST_CARRIER = 'Great West'

export const BONUS_RATE_HIGH = 0.10   // > 80% renewal rate
export const BONUS_RATE_LOW  = 0.08   // ≤ 80% renewal rate
export const BONUS_RATE_GW   = 0.02   // Great West carrier override

export const RENEWAL_TYPES = ['renewal', 'rewrite']

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isRenewed(policy) {
  return !!policy.firstPaymentDate
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function effectiveRate(policy, empBonusRate) {
  return policy.carrier === GREAT_WEST_CARRIER ? BONUS_RATE_GW : (empBonusRate ?? BONUS_RATE_LOW)
}

// ─── Renewal Rate ─────────────────────────────────────────────────────────────

/**
 * Returns policies that count toward this employee's renewal rate.
 * Optionally scoped to a date range based on expirationDate.
 */
export function getRenewalEligiblePolicies(policies, employeeId, startDate = null, endDate = null) {
  return policies.filter(p => {
    if (p.employeeId !== employeeId) return false
    if (!RENEWAL_TYPES.includes(p.type)) return false
    if (p.status === 'cancelled' && !p.firstPaymentDate) return false
    if (startDate && endDate) {
      const exp = new Date(p.expirationDate)
      return exp >= new Date(startDate) && exp <= new Date(endDate)
    }
    return true
  })
}

/** Returns { rate: 0-1 | null, renewed: n, total: n } */
export function calcRenewalRate(policies, employeeId, startDate = null, endDate = null) {
  const eligible = getRenewalEligiblePolicies(policies, employeeId, startDate, endDate)
  if (eligible.length === 0) return { rate: null, renewed: 0, total: 0 }
  const renewed = eligible.filter(isRenewed).length
  return { rate: renewed / eligible.length, renewed, total: eligible.length }
}

/** Returns 0.10 or 0.08 based on renewal rate (null if no data). */
export function getEmployeeBonusRate(renewalRate) {
  if (renewalRate === null) return null
  return renewalRate > 0.80 ? BONUS_RATE_HIGH : BONUS_RATE_LOW
}

// ─── Base Bonus ───────────────────────────────────────────────────────────────

/**
 * Calculates the base bonus for a single renewed policy.
 * Uses renewalPremium if set, otherwise falls back to premium.
 */
export function calcPolicyBonus(policy, empBonusRate) {
  if (!isRenewed(policy)) return 0
  const premium = policy.renewalPremium ?? policy.premium
  if (!premium || premium <= 0) return 0
  return premium * effectiveRate(policy, empBonusRate)
}

// ─── Endorsements ─────────────────────────────────────────────────────────────

/**
 * Calculates the prorated bonus adjustment for one endorsement.
 *
 * Premium increase  → positive adjustment (additional bonus)
 * Premium decrease  → negative adjustment (chargeback)
 *
 * Formula: (newPremium − previousPremium) × rate × (daysRemaining ÷ totalTermDays)
 */
export function calcEndorsementAdjustment(policy, endorsement, empBonusRate) {
  const totalDays = Math.max(1, daysBetween(policy.effectiveDate, policy.expirationDate))
  const daysRemaining = Math.max(0, daysBetween(endorsement.endorsementDate, policy.expirationDate))
  const pctRemaining  = daysRemaining / totalDays

  const premiumChange = endorsement.newPremium - endorsement.previousPremium
  const rate          = effectiveRate(policy, empBonusRate)
  const adjustment    = premiumChange * rate * pctRemaining

  return {
    endorsementId:   endorsement.id,
    endorsementDate: endorsement.endorsementDate,
    previousPremium: endorsement.previousPremium,
    newPremium:      endorsement.newPremium,
    premiumChange,
    adjustment,
    pctRemaining,
    daysRemaining,
    totalDays,
    rate,
    isIncrease: premiumChange > 0,
    notes: endorsement.notes ?? '',
  }
}

/**
 * Calculates Net Bonus = Base Bonus + Σ(Endorsement Adjustments)
 *
 * Returns full breakdown for display.
 */
export function calcNetBonus(policy, policyEndorsements, empBonusRate) {
  if (!policy.firstPaymentDate) {
    return { baseBonus: 0, adjustments: [], totalAdjustments: 0, netBonus: 0 }
  }

  const baseBonus = calcPolicyBonus(policy, empBonusRate)

  const sorted = [...policyEndorsements]
    .sort((a, b) => new Date(a.endorsementDate) - new Date(b.endorsementDate))

  const adjustments    = sorted.map(e => calcEndorsementAdjustment(policy, e, empBonusRate))
  const totalAdjustments = adjustments.reduce((sum, a) => sum + a.adjustment, 0)

  return {
    baseBonus,
    adjustments,
    totalAdjustments,
    netBonus: baseBonus + totalAdjustments,
  }
}

/**
 * Returns the current (most recent) premium for a policy, accounting for endorsements.
 */
export function getCurrentPremium(policy, policyEndorsements) {
  if (!policyEndorsements || policyEndorsements.length === 0) {
    return policy.renewalPremium ?? policy.premium ?? 0
  }
  const sorted = [...policyEndorsements]
    .sort((a, b) => new Date(a.endorsementDate) - new Date(b.endorsementDate))
  return sorted[sorted.length - 1].newPremium
}

// ─── Cancellation Clawback ────────────────────────────────────────────────────

/**
 * Calculates prorated clawback on NET bonus for a cancellation.
 *
 * Clawback = Net Bonus × (daysRemaining ÷ totalTermDays)
 * Net Bonus = Base Bonus + Σ(Endorsement Adjustments)
 *
 * Returns full breakdown for the detail modal.
 */
export function calcCancellationClawback(policy, policyEndorsements, cancellationDate, empBonusRate) {
  const { baseBonus, adjustments, totalAdjustments, netBonus } =
    calcNetBonus(policy, policyEndorsements ?? [], empBonusRate)

  const totalDays     = Math.max(1, daysBetween(policy.effectiveDate, policy.expirationDate))
  const daysElapsed   = Math.max(0, daysBetween(policy.effectiveDate, cancellationDate))
  const daysRemaining = Math.max(0, totalDays - daysElapsed)
  const pctRemaining  = daysRemaining / totalDays
  const pctElapsed    = daysElapsed    / totalDays

  const clawbackAmount = netBonus * pctRemaining

  return {
    baseBonus,
    adjustments,
    totalAdjustments,
    netBonus,
    clawbackAmount,
    pctRemaining,
    pctElapsed,
    daysElapsed,
    daysRemaining,
    totalDays,
    netAfterClawback: netBonus - clawbackAmount,
  }
}

/**
 * Standalone clawback calculator for manual entry (no endorsements).
 */
export function calcClawbackManual({ bonusAmount, effectiveDate, expirationDate, cancellationDate }) {
  const totalDays     = Math.max(1, daysBetween(effectiveDate, expirationDate))
  const daysElapsed   = Math.max(0, daysBetween(effectiveDate, cancellationDate))
  const daysRemaining = Math.max(0, totalDays - daysElapsed)
  const pctRemaining  = daysRemaining / totalDays
  const clawbackAmount = bonusAmount * pctRemaining

  return {
    clawbackAmount,
    pctRemaining,
    pctElapsed:    daysElapsed / totalDays,
    daysElapsed,
    daysRemaining,
    totalDays,
    bonusAmount,
    netBonus:       bonusAmount - clawbackAmount,
    netAfterClawback: bonusAmount - clawbackAmount,
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmt$(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount)
}

export function fmtPct(rate, decimals = 1) {
  if (rate === null || rate === undefined) return '—'
  return (rate * 100).toFixed(decimals) + '%'
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtMonthYear(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}
