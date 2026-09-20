// src/pages/ExpensesPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Expense { id:string; form_number:string; submitted_by_name:string; project_name:string; grand_total:number; status:string; submitted_at:string }

export default function ExpensesPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const su         = isSuperUser(user)
  const submitOnly = user?.permissions?.finance === 'submit_only'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (submitOnly) { setLoading(false); return }
    api.get<{ expenses:Expense[] }>('/expenses')
      .then(d => setExpenses(d.expenses))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [submitOnly])

  const sar = (n: number) => `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2})}`

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <h1 className="page-title">Expenses</h1>
        <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>+ New Expense</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {submitOnly && (
        <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>
          You have submit-only access. Previous submissions are not visible.<br />
          <button className="btn btn-primary" style={{ marginTop:'1rem' }} onClick={() => navigate('/expenses/new')}>Submit New Expense</button>
        </div>
      )}

      {loading && <div style={{ color:'var(--text-muted)', padding:'1rem' }}>Loading…</div>}

      {!loading && !submitOnly && (
        <div className="glass table-wrap">
          <table>
            <thead>
              <tr>
                <th>Form #</th>
                {su && <th>Submitted By</th>}
                <th>Project</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={su?6:5} style={{ textAlign:'center', color:'var(--muted)', padding:'2.5rem' }}>No expenses yet. Click "+ New Expense" to add one.</td></tr>}
              {expenses.map(e => (
                <tr key={e.id}>
                  <td><span className="mono" style={{ color:'var(--cyan)', fontSize:'0.85rem' }}>{e.form_number}</span></td>
                  {su && <td style={{ fontSize:'0.875rem' }}>{e.submitted_by_name}</td>}
                  <td style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{e.project_name || '—'}</td>
                  <td><span className="mono" style={{ fontSize:'0.875rem' }}>{sar(e.grand_total)}</span></td>
                  <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                  <td style={{ color:'var(--muted)', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{new Date(e.submitted_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
