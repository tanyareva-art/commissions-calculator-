import React, { createContext, useContext, useReducer } from 'react'
import {
  genId,
  calcPolicyBonus,
  calcRenewalRate,
  getEmployeeBonusRate,
  calcEndorsementAdjustment,
  GREAT_WEST_CARRIER,
  BONUS_RATE_GW,
} from '../utils/calculations'

const STORAGE_KEY = 'commissions_app_v2'

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  employees:    [],
  policies:     [],
  endorsements: [],
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // Migrate from v1 if present
    const v1 = localStorage.getItem('commissions_app_v1')
    if (v1) {
      const parsed = JSON.parse(v1)
      return { ...initialState, employees: parsed.employees ?? [], policies: parsed.policies ?? [] }
    }
    return initialState
  } catch {
    return initialState
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* storage full */ }
}

// ─── Bonus Recalculation ──────────────────────────────────────────────────────

/**
 * Recomputes bonusAmount, adjustmentTotal, netBonus, and clawbackAmount
 * for every policy whenever state changes.
 */
function recalcBonuses(state) {
  const { employees, policies, endorsements } = state

  // Step 1: compute each employee's bonus rate from their renewal rate
  const empRates = {}
  employees.forEach(emp => {
    const { rate } = calcRenewalRate(policies, emp.id)
    empRates[emp.id] = getEmployeeBonusRate(rate)
  })

  // Step 2: recompute per-policy bonus fields
  const updatedPolicies = policies.map(p => {
    // No bonus until first payment received
    if (!p.firstPaymentDate) {
      return { ...p, bonusAmount: null, bonusRate: null, adjustmentTotal: null, netBonus: null, clawbackAmount: p.status === 'cancelled' ? 0 : null }
    }

    const empRate    = empRates[p.employeeId] ?? 0.08
    const bonusRate  = p.carrier === GREAT_WEST_CARRIER ? BONUS_RATE_GW : empRate
    const baseBonus  = calcPolicyBonus(p, empRate)

    // Sum endorsement adjustments for this policy
    const policyEndorsements = endorsements.filter(e => e.policyId === p.id)
    const adjustments        = policyEndorsements.map(e => calcEndorsementAdjustment(p, e, empRate))
    const adjustmentTotal    = adjustments.reduce((sum, a) => sum + a.adjustment, 0)
    const netBonus           = baseBonus + adjustmentTotal

    // Recalculate clawback on NET bonus for cancelled policies
    let clawbackAmount = p.clawbackAmount ?? null
    if (p.status === 'cancelled' && p.cancellationDate) {
      const totalDays     = Math.max(1, Math.round((new Date(p.expirationDate) - new Date(p.effectiveDate)) / 86400000))
      const daysElapsed   = Math.max(0, Math.round((new Date(p.cancellationDate) - new Date(p.effectiveDate)) / 86400000))
      const daysRemaining = Math.max(0, totalDays - daysElapsed)
      clawbackAmount      = netBonus * (daysRemaining / totalDays)
    }

    return { ...p, bonusAmount: baseBonus, bonusRate, adjustmentTotal, netBonus, clawbackAmount }
  })

  return { ...state, policies: updatedPolicies }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state, action) {
  let next = state

  switch (action.type) {

    // ── Employees ──────────────────────────────────────────────────────────
    case 'ADD_EMPLOYEE': {
      const employee = { id: genId(), createdAt: new Date().toISOString(), ...action.payload }
      next = { ...state, employees: [...state.employees, employee] }
      break
    }
    case 'UPDATE_EMPLOYEE': {
      next = { ...state, employees: state.employees.map(e => e.id === action.payload.id ? { ...e, ...action.payload } : e) }
      break
    }
    case 'DELETE_EMPLOYEE': {
      const empId = action.payload
      next = {
        ...state,
        employees:    state.employees.filter(e => e.id !== empId),
        policies:     state.policies.filter(p => p.employeeId !== empId),
        endorsements: state.endorsements.filter(e => {
          const pol = state.policies.find(p => p.id === e.policyId)
          return pol?.employeeId !== empId
        }),
      }
      break
    }

    // ── Policies ───────────────────────────────────────────────────────────
    case 'ADD_POLICY': {
      const policy = {
        id: genId(),
        createdAt: new Date().toISOString(),
        firstPaymentDate: null,
        cancellationDate: null,
        renewalPremium:   null,
        bonusAmount:      null,
        bonusRate:        null,
        adjustmentTotal:  null,
        netBonus:         null,
        clawbackAmount:   null,
        notes: '',
        ...action.payload,
      }
      next = { ...state, policies: [...state.policies, policy] }
      break
    }
    case 'UPDATE_POLICY': {
      next = { ...state, policies: state.policies.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) }
      break
    }
    case 'DELETE_POLICY': {
      next = {
        ...state,
        policies:     state.policies.filter(p => p.id !== action.payload),
        endorsements: state.endorsements.filter(e => e.policyId !== action.payload),
      }
      break
    }

    // ── Mark Renewed (first payment received) ─────────────────────────────
    case 'MARK_RENEWED': {
      const { policyId, firstPaymentDate, renewalPremium } = action.payload
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === policyId
            ? { ...p, status: 'renewed', firstPaymentDate, renewalPremium: renewalPremium ?? p.renewalPremium ?? p.premium }
            : p
        ),
      }
      break
    }

    // ── Update Renewal Premium (correction, not endorsement) ──────────────
    case 'UPDATE_RENEWAL_PREMIUM': {
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === action.payload.policyId ? { ...p, renewalPremium: action.payload.renewalPremium } : p
        ),
      }
      break
    }

    // ── Endorsements ──────────────────────────────────────────────────────
    case 'ADD_ENDORSEMENT': {
      const { policyId, endorsementDate, newPremium, notes } = action.payload

      // Determine previousPremium from the endorsement chain
      const existing = state.endorsements
        .filter(e => e.policyId === policyId)
        .sort((a, b) => new Date(a.endorsementDate) - new Date(b.endorsementDate))

      const policy          = state.policies.find(p => p.id === policyId)
      const previousPremium = existing.length > 0
        ? existing[existing.length - 1].newPremium
        : (policy?.renewalPremium ?? policy?.premium ?? 0)

      const premiumChange = newPremium - previousPremium

      const endorsement = {
        id:       genId(),
        createdAt: new Date().toISOString(),
        policyId,
        endorsementDate,
        previousPremium,
        newPremium,
        premiumChange,
        type:  premiumChange >= 0 ? 'increase' : 'decrease',
        notes: notes ?? '',
      }
      next = { ...state, endorsements: [...state.endorsements, endorsement] }
      break
    }

    case 'DELETE_ENDORSEMENT': {
      next = { ...state, endorsements: state.endorsements.filter(e => e.id !== action.payload) }
      break
    }

    // ── Mark Cancelled ────────────────────────────────────────────────────
    case 'MARK_CANCELLED': {
      const { policyId, cancellationDate } = action.payload
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === policyId ? { ...p, status: 'cancelled', cancellationDate } : p
        ),
      }
      break
    }

    // ── Reinstate Policy ──────────────────────────────────────────────────
    case 'REINSTATE_POLICY': {
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === action.payload
            ? { ...p, status: p.firstPaymentDate ? 'renewed' : 'active', cancellationDate: null, clawbackAmount: null }
            : p
        ),
      }
      break
    }

    // ── Mark Lost ─────────────────────────────────────────────────────────
    case 'MARK_LOST': {
      next = { ...state, policies: state.policies.map(p => p.id === action.payload ? { ...p, status: 'lost' } : p) }
      break
    }

    default:
      return state
  }

  const result = recalcBonuses(next)
  saveState(result)
  return result
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    const loaded = loadState()
    return recalcBonuses(loaded)
  })

  const getEmployee         = id => state.employees.find(e => e.id === id)
  const getEmployeePolicies = id => state.policies.filter(p => p.employeeId === id)
  const getPolicyEndorsements = policyId => state.endorsements.filter(e => e.policyId === policyId)
    .sort((a, b) => new Date(a.endorsementDate) - new Date(b.endorsementDate))

  return (
    <AppContext.Provider value={{ state, dispatch, getEmployee, getEmployeePolicies, getPolicyEndorsements }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
