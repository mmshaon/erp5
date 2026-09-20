// src/pages/WalletPage.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface WalletData {
  balance:  { total_received:number; total_expenses:number; current_balance:number }
  advances: { id:string; amount:number; description:string; received_at:string }[]
}

export default function WalletPage() {
  const { user } = useAuth()
  const [data,    setData]    = useState<WalletData|null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get<WalletData>('/reports/wallet')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sar = (n:number) => `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const bal = Number(data?.balance?.current_balance ?? 0)

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom:'1.25rem' }}>My Wallet — {user?.full_name}</h1>
      {error   && <div className="alert-error">{error}</div>}
      {loading && <div style={{ color:'var(--text-muted)', padding:'1rem' }}>Loading…</div>}
      {!loading && data && (
        <>
          <div className="stat-grid" style={{ marginBottom:'1.25rem' }}>
            {[
              { label:'Total Cash Received', value:sar(data.balance.total_received),  accent:'var(--cyan)' },
              { label:'Total Expenses',      value:sar(data.balance.total_expenses),   accent:'var(--warning)' },
              { label:'Current Balance',     value:sar(bal),                           accent: bal>=0?'var(--success)':'var(--error)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.4rem' }}>{s.label}</div>
                <div className="mono" style={{ fontSize:'1.3rem', fontWeight:600, color:s.accent }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="glass table-wrap">
            <div style={{ padding:'1rem 1rem 0' }}><div className="section-label">Cash Advance History</div></div>
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {data.advances.length===0 && <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>No cash advances recorded yet.</td></tr>}
                {data.advances.map(a => (
                  <tr key={a.id}>
                    <td style={{ color:'var(--text-muted)', fontSize:'0.85rem', whiteSpace:'nowrap' }}>{new Date(a.received_at).toLocaleDateString('en-GB')}</td>
                    <td>{a.description||'—'}</td>
                    <td><span className="mono" style={{ color:'var(--success)' }}>{sar(a.amount)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
