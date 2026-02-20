import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { genId, calcPolicyBonus, calcRenewalRate, getEmployeeBonusRate } from '../utils/calculations'

const STORAGE_KEY = 'commissions_app_v1'

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
  employees: [],
  policies: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : initialState
  } catch {
    return initialState
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Recalculates bonus for every policy that has been renewed (firstPaymentDate set).
 * Needs to run after any policy or employee change that affects renewal rates.
 */
function recalcBonuses(state) {
  const { employees, policies } = state

  // For each employee, compute their bonus rate
  const employeeBonusRates = {}
  employees.forEach(emp => {
    const { rate } = calcRenewalRate(policies, emp.id)
    employeeBonusRates[emp.id] = getEmployeeBonusRate(rate)
  })

  const updatedPolicies = policies.map(p => {
    if (!p.firstPaymentDate) return { ...p, bonusAmount: null, bonusRate: null }
    const empRate = employeeBonusRates[p.employeeId] ?? 0.08
    const bonusAmount = calcPolicyBonus(p, empRate)
    const bonusRate   = p.carrier === 'Great West' ? 0.02 : empRate
    return { ...p, bonusAmount, bonusRate }
  })

  return { ...state, policies: updatedPolicies }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  let next = state

  switch (action.type) {
    // Employees
    case 'ADD_EMPLOYEE': {
      const employee = { id: genId(), createdAt: new Date().toISOString(), ...action.payload }
      next = { ...state, employees: [...state.employees, employee] }
      break
    }
    case 'UPDATE_EMPLOYEE': {
      next = {
        ...state,
        employees: state.employees.map(e => e.id === action.payload.id ? { ...e, ...action.payload } : e),
      }
      break
    }
    case 'DELETE_EMPLOYEE': {
      next = {
        ...state,
        employees: state.employees.filter(e => e.id !== action.payload),
        policies: state.policies.filter(p => p.employeeId !== action.payload),
      }
      break
    }

    // Policies
    case 'ADD_POLICY': {
      const policy = {
        id: genId(),
        createdAt: new Date().toISOString(),
        firstPaymentDate: null,
        cancellationDate: null,
        renewalPremium: null,
        bonusAmount: null,
        bonusRate: null,
        clawbackAmount: null,
        notes: '',
        ...action.payload,
      }
      next = { ...state, policies: [...state.policies, policy] }
      break
    }
    case 'UPDATE_POLICY': {
      next = {
        ...state,
        policies: state.policies.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p),
      }
      break
    }
    case 'DELETE_POLICY': {
      next = { ...state, policies: state.policies.filter(p => p.id !== action.payload) }
      break
    }

    // Mark renewed (first payment received)
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

    // Update premium after renewal (recalculates bonus)
    case 'UPDATE_RENEWAL_PREMIUM': {
      const { policyId, renewalPremium } = action.payload
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === policyId ? { ...p, renewalPremium } : p
        ),
      }
      break
    }

    // Mark cancelled — stores clawback amount
    case 'MARK_CANCELLED': {
      const { policyId, cancellationDate, clawbackAmount } = action.payload
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === policyId
            ? { ...p, status: 'cancelled', cancellationDate, clawbackAmount }
            : p
        ),
      }
      break
    }

    // Undo cancellation
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

    // Mark lost (came up for renewal but not renewed)
    case 'MARK_LOST': {
      next = {
        ...state,
        policies: state.policies.map(p =>
          p.id === action.payload ? { ...p, status: 'lost' } : p
        ),
      }
      break
    }

    case 'LOAD_STATE':
      return action.payload

    default:
      return state
  }

  const withBonuses = recalcBonuses(next)
  saveState(withBonuses)
  return withBonuses
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    const loaded = loadState()
    return recalcBonuses(loaded)
  })

  // Expose helpers
  const getEmployee = id => state.employees.find(e => e.id === id)
  const getEmployeePolicies = id => state.policies.filter(p => p.employeeId === id)

  return (
    <AppContext.Provider value={{ state, dispatch, getEmployee, getEmployeePolicies }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
