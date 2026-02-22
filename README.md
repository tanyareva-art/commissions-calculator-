# Agency Commission Calculator

Commission tracking and bonus management tool for a small commercial trucking insurance agency.
Fully browser-based — no backend, no login. All data stored in your browser's localStorage.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18 or later
- npm v9 or later (comes with Node.js)

### Install & Run

```bash
# 1. Clone or download the repository
git clone <repo-url>
cd commissions-calculator-

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser to **http://localhost:5173**

### Production Build

```bash
npm run build       # outputs to dist/
npm run preview     # preview the production build locally
```

---

## Business Rules Implemented

### Bonus Tiers
| Condition | Rate | Applies To |
|---|---|---|
| Employee renewal rate **> 80%** | **10%** | All non-Great-West renewed policies |
| Employee renewal rate **≤ 80%** | **8%**  | All non-Great-West renewed policies |
| **Great West** carrier (any tier) | **2%** | Overrides tier — always 2% |

### Renewal Rate
- Counts only **renewal** and **rewrite** policy types
- A policy is counted as renewed when **first payment date** is recorded
- Denominator = all renewal/rewrite policies (renewed + lost + pending)
- New business policies are excluded

### Endorsements
- **Premium increase** → positive bonus adjustment (additional earnings)
- **Premium decrease** → negative adjustment / chargeback
- Formula: `(newPremium − prevPremium) × bonusRate × (daysRemaining ÷ totalTermDays)`
- Multiple endorsements chain from previous premium

### Net Bonus
```
Net Bonus = Base Renewal Bonus + Σ(Endorsement Adjustments)
```

### Cancellation Clawback
Clawback applies to the **net bonus** (after all endorsement adjustments):
```
Clawback = Net Bonus × (daysRemaining ÷ totalTermDays)
Final Payout = Net Bonus − Clawback
```

---

## Features

| Page | Features |
|---|---|
| **Dashboard** | Agency summary (renewal %, total bonus, clawbacks, net payout) · Monthly filter · Employee performance table with color-coded columns |
| **Employees** | Add / edit / delete producers · Per-employee metrics (renewal %, tier, base bonus, endorsement adjustments, net payout, clawbacks) |
| **Policies** | Add / edit / delete policies · Mark Renewed (records first payment + renewal premium) · Add Endorsement (live preview of adjustment) · Cancel (prorated clawback preview + full detail modal) · Mark Lost · Reinstate · Expandable endorsement history per policy |
| **Clawback Calc** | Standalone calculator · Manual entry or select existing policy · Endorsement adjustments shown · Full formula breakdown |

### Color Legend
| Color | Meaning |
|---|---|
| **Green** | Bonus earned · High tier (10%) · Positive adjustments |
| **Amber/Brown** | Standard tier (8%) · Endorsement adjustments column |
| **Red** | Clawbacks · Cancellations · Negative adjustments |
| **Blue** | Net payout · Active policies · Neutral metrics |
| **Yellow** | Great West carrier (2% override) |

---

## Tech Stack

- **React 18** + **Vite** — frontend framework and build tool
- **Tailwind CSS** — utility-first styling
- **React Router v6** — client-side navigation
- **Lucide React** — icons
- **localStorage** — data persistence (no backend required)

---

## Data & Privacy

All data is stored in your **browser's localStorage** under the key `commissions_app_v2`.
- No data is sent to any server
- Clearing browser data will erase all records
- To back up: open DevTools → Application → Local Storage → copy the value of `commissions_app_v2`
