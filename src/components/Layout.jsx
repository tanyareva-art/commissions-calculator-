import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, Calculator, ChevronLeft, ChevronRight, Truck } from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/employees', icon: Users,           label: 'Employees'    },
  { to: '/policies',  icon: FileText,        label: 'Policies'     },
  { to: '/clawback',  icon: Calculator,      label: 'Clawback Calc'},
]

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className={`flex flex-col bg-navy-900 text-white transition-all duration-200 flex-shrink-0 ${collapsed ? 'w-16' : 'w-56'}`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-navy-700">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Truck size={17} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white truncate">Commissions</p>
              <p className="text-xs text-navy-400 truncate">Trucking Agency</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-navy-700 text-white shadow-sm'
                    : 'text-navy-400 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center py-3 border-t border-navy-800 text-navy-500 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
