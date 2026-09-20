// src/pages/InvoicesPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Invoice { id:string; invoice_number:string; submitted_by_name:string; client_name:string; grand_total:number; status:string; submitted_at:string }

export default function InvoicesPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const su         = isSuperUser(user)
  const submitOnly = user?.permissions?.finance === 'submit_only'

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (submitOnly) { setLoading(false); return }
    api.get<{ invoices:Invoice[] }>('/invoices')
      .then(d => setInvoices(d.invoices))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [submitOnly])

  const sar = (n: number) => `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2})}`

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <h1 className="page-title">Invoices</h1>
        <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>+ New Invoice</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {submitOnly && (
        <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>
          You have submit-only access.<br />
          <button className="btn btn-primary" style={{ marginTop:'1rem' }} onClick={() => navigate('/invoices/new')}>Submit New Invoice</button>
        </div>
      )}
      {loading && <div style={{ color:'var(--text-muted)', padding:'1rem' }}>Loading…</div>}
      {!loading && !submitOnly && (
        <div className="glass table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                {su && <th>Submitted By</th>}
                <th>Client</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={su?6:5} style={{ textAlign:'center', color:'var(--muted)', padding:'2.5rem' }}>No invoices yet.</td></tr>}
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td><span className="mono" style={{ color:'var(--cyan)', fontSize:'0.85rem' }}>{inv.invoice_number}</span></td>
                  {su && <td style={{ fontSize:'0.875rem' }}>{inv.submitted_by_name}</td>}
                  <td style={{ fontSize:'0.875rem' }}>{inv.client_name}</td>
                  <td><span className="mono" style={{ fontSize:'0.875rem' }}>{sar(inv.grand_total)}</span></td>
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td style={{ color:'var(--muted)', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{new Date(inv.submitted_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
