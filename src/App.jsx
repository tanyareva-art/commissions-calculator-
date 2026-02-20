import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Policies from './pages/Policies'
import ClawbackCalculator from './pages/ClawbackCalculator'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/policies"  element={<Policies />} />
        <Route path="/clawback"  element={<ClawbackCalculator />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
