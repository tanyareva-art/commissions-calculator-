/**
 * Commission Calculation Engine
 *
 * Rules:
 * 1. No base commission — bonus only.
 * 2. Renewal bonus:
 *    - Great West carrier  → 2%  of renewal GWP (always, ignores renewal rate)
 *    - Other carriers:
 *        employee renewal rate > 80%  → 10% of renewal GWP
 *        employee renewal rate ≤ 80%  → 8%  of renewal GWP
 * 3. "Renewed" = first payment received date is set.
 * 4. Rewrites count as renewed.
 * 5. Prorated clawback = bonus_earned × (days_remaining / total_term_days)
 * 6. Bonus recalculates whenever the renewal premium changes.
 */

export const GREAT_WEST_CARRIER = 'Great West'

export const BONUS_RATE_HIGH  = 0.10   // >80% renewal rate
export const BONUS_RATE_LOW   = 0.08   // ≤80% renewal rate
export const BONUS_RATE_GW    = 0.02   // Great West override

/** Policies that count toward the renewal-rate denominator */
export const RENEWAL_TYPES = ['renewal', 'rewrite']

/** A policy is "counted as renewed" when it has a firstPaymentDate */
export function isRenewed(policy) {
  return !!policy.firstPaymentDate
}

/**
 * Returns the set of policies that are "up for renewal" for an employee
 * within an optional date range (based on expirationDate).
 * If no range provided, returns all renewal/rewrite type policies.
 */
export function getRenewalEligiblePolicies(policies, employeeId, startDate = null, endDate = null) {
  return policies.filter(p => {
    if (p.employeeId !== employeeId) return false
    if (!RENEWAL_TYPES.includes(p.type)) return false
    if (p.status === 'cancelled' && !p.firstPaymentDate) return false // cancelled before any renewal
    if (startDate && endDate) {
      const exp = new Date(p.expirationDate)
      return exp >= new Date(startDate) && exp <= new Date(endDate)
    }
    return true
  })
}

/**
 * Calculates renewal rate for an employee.
 * Returns { rate: 0-1, renewed: n, total: n }
 */
export function calcRenewalRate(policies, employeeId, startDate = null, endDate = null) {
  const eligible = getRenewalEligiblePolicies(policies, employeeId, startDate, endDate)
  if (eligible.length === 0) return { rate: null, renewed: 0, total: 0 }

  const renewed = eligible.filter(isRenewed).length
  return {
    rate: renewed / eligible.length,
    renewed,
    total: eligible.length,
  }
}

/**
 * Returns the bonus rate for an employee based on their renewal rate.
 * Carrier-level override (Great West) is applied per-policy in calcPolicyBonus.
 */
export function getEmployeeBonusRate(renewalRate) {
  if (renewalRate === null) return null
  return renewalRate > 0.80 ? BONUS_RATE_HIGH : BONUS_RATE_LOW
}

/**
 * Calculates the bonus dollar amount for a single policy.
 * @param {object} policy - the policy (must have carrier, premium/renewalPremium, firstPaymentDate)
 * @param {number} employeeBonusRate - 0.10 or 0.08 (from getEmployeeBonusRate)
 * @returns {number} bonus amount in dollars
 */
export function calcPolicyBonus(policy, employeeBonusRate) {
  if (!isRenewed(policy)) return 0
  const premium = policy.renewalPremium ?? policy.premium
  if (!premium || premium <= 0) return 0

  const rate = policy.carrier === GREAT_WEST_CARRIER ? BONUS_RATE_GW : (employeeBonusRate ?? BONUS_RATE_LOW)
  return premium * rate
}

/**
 * Calculates the prorated clawback amount for a cancelled policy.
 *
 * Formula:
 *   pct_remaining = (expirationDate - cancellationDate) / (expirationDate - effectiveDate)
 *   clawback      = bonusEarned × pct_remaining
 *
 * @returns { clawbackAmount, pctRemaining, daysElapsed, totalDays, daysRemaining }
 */
export function calcClawback(policy, cancellationDate) {
  const effective = new Date(policy.effectiveDate)
  const expiration = new Date(policy.expirationDate)
  const cancel    = new Date(cancellationDate)

  const totalDays    = Math.max(1, Math.round((expiration - effective) / 86400000))
  const daysElapsed  = Math.max(0, Math.round((cancel - effective) / 86400000))
  const daysRemaining = Math.max(0, totalDays - daysElapsed)
  const pctRemaining  = daysRemaining / totalDays

  const bonusEarned = policy.bonusAmount ?? 0
  const clawbackAmount = bonusEarned * pctRemaining

  return {
    clawbackAmount,
    pctRemaining,
    pctElapsed: daysElapsed / totalDays,
    daysElapsed,
    daysRemaining,
    totalDays,
    bonusEarned,
    netBonus: bonusEarned - clawbackAmount,
  }
}

/**
 * Standalone clawback calculator (no policy object required).
 */
export function calcClawbackManual({ bonusAmount, effectiveDate, expirationDate, cancellationDate }) {
  const effective  = new Date(effectiveDate)
  const expiration = new Date(expirationDate)
  const cancel     = new Date(cancellationDate)

  const totalDays     = Math.max(1, Math.round((expiration - effective) / 86400000))
  const daysElapsed   = Math.max(0, Math.round((cancel - effective) / 86400000))
  const daysRemaining = Math.max(0, totalDays - daysElapsed)
  const pctRemaining  = daysRemaining / totalDays
  const clawbackAmount = bonusAmount * pctRemaining

  return {
    clawbackAmount,
    pctRemaining,
    pctElapsed: daysElapsed / totalDays,
    daysElapsed,
    daysRemaining,
    totalDays,
    bonusAmount,
    netBonus: bonusAmount - clawbackAmount,
  }
}

/** Format currency */
export function fmt$(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

/** Format percentage */
export function fmtPct(rate, decimals = 1) {
  if (rate === null || rate === undefined) return '—'
  return (rate * 100).toFixed(decimals) + '%'
}

/** Format date for display */
export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Generate a simple unique ID */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** Get today as YYYY-MM-DD */
export function today() {
  return new Date().toISOString().slice(0, 10)
}
