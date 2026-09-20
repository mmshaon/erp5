// src/App.tsx — Alpha Ultimate ERP v5
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LangProvider } from './lib/LangContext'
import { ReactNode } from 'react'

import LoginPage         from './pages/LoginPage'
import ERPLayout         from './pages/ERPLayout'
import Dashboard         from './pages/Dashboard'
import ExpensesPage      from './pages/ExpensesPage'
import ExpenseFormPage   from './pages/ExpenseFormPage'
import InvoicesPage      from './pages/InvoicesPage'
import InvoiceFormPage   from './pages/InvoiceFormPage'
import ApprovalDashboard from './pages/ApprovalDashboard'
import UsersPage         from './pages/UsersPage'
import PermissionsPage   from './pages/PermissionsPage'
import ReportsPage       from './pages/ReportsPage'
import WalletPage        from './pages/WalletPage'

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07061a', color:'#4f8cff', fontFamily:'Space Mono,monospace', fontSize:'0.8rem', letterSpacing:'0.1em', flexDirection:'column', gap:'1rem' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(79,140,255,0.3)', borderTopColor:'#4f8cff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span>LOADING…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Guard><ERPLayout /></Guard>}>
              <Route index                  element={<Dashboard />} />
              <Route path="expenses"        element={<ExpensesPage />} />
              <Route path="expenses/new"    element={<ExpenseFormPage />} />
              <Route path="invoices"        element={<InvoicesPage />} />
              <Route path="invoices/new"    element={<InvoiceFormPage />} />
              <Route path="wallet"          element={<WalletPage />} />
              <Route path="approvals"       element={<ApprovalDashboard />} />
              <Route path="users"           element={<UsersPage />} />
              <Route path="permissions"     element={<PermissionsPage />} />
              <Route path="reports"         element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  )
}

export default App
