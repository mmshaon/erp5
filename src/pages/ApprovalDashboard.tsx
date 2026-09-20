// src/pages/ApprovalDashboard.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Item { id:string; form_number?:string; invoice_number?:string; submitted_by_name:string; grand_total:number; status:string; submitted_at:string; project_name?:string; client_name?:string; notes?:string }
type Tab = 'expenses'|'invoices'

export default function ApprovalDashboard() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [tab,     setTab]     = useState<Tab>('expenses')
  const [items,   setItems]   = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [comment, setComment] = useState<Record<string,string>>({})
  const [acting,  setActing]  = useState<string|null>(null)

  useEffect(() => {
    if (!su) { setLoading(false); return }
    setLoading(true); setError('')
    const ep = tab === 'expenses' ? '/expenses' : '/invoices'
    api.get<{ expenses?:Item[]; invoices?:Item[] }>(ep)
      .then(d => {
        const raw = (tab==='expenses' ? d.expenses : d.invoices) ?? []
        setItems(raw.filter(i => i.status==='pending'||i.status==='hold'))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tab, su])

  async function act(id: string, action: 'approve'|'reject'|'hold') {
    if (action==='reject' && !comment[id]?.trim()) { setError('A comment is required when rejecting.'); return }
    setError(''); setActing(id)
    try {
      const ep  = tab==='expenses' ? '/expenses/approve' : '/invoices/approve'
      const key = tab==='expenses' ? 'expense_id' : 'invoice_id'
      await api.post(ep, { [key]:id, action, comment: comment[id]??'' })
      setItems(p => p.filter(i => i.id!==id))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Action failed') }
    finally { setActing(null) }
  }

  if (!su) return <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>Approval access requires superuser privileges.</div>

  const sar = (n:number) => `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2})}`

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom:'1.25rem' }}>Approval Queue</h1>

      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem' }}>
        {(['expenses','invoices'] as Tab[]).map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`btn ${tab===t?'btn-primary':'btn-secondary'}`} style={{ textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <div style={{ color:'var(--text-muted)' }}>Loading…</div>}
      {!loading && items.length===0 && <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--muted)' }}>No pending items in this queue. ✓</div>}

      {items.map(item => (
        <div key={item.id} className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', marginBottom:'1rem' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', marginBottom:'0.4rem', flexWrap:'wrap' }}>
                <span className="mono" style={{ color:'var(--cyan)', fontWeight:600 }}>{item.form_number??item.invoice_number}</span>
                <span className={`badge badge-${item.status}`}>{item.status}</span>
              </div>
              <div style={{ fontSize:'0.875rem', color:'var(--text)', fontWeight:500 }}>{item.submitted_by_name}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.15rem' }}>
                {item.project_name??item.client_name??'—'} &nbsp;·&nbsp; {new Date(item.submitted_at).toLocaleDateString('en-GB')}
              </div>
              {item.notes && <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginTop:'0.2rem', fontStyle:'italic' }}>{item.notes}</div>}
            </div>
            <div className="mono" style={{ fontSize:'1.25rem', fontWeight:600, color:'var(--cyan)', whiteSpace:'nowrap' }}>{sar(item.grand_total)}</div>
          </div>

          <div style={{ marginBottom:'0.85rem' }}>
            <label className="label">Admin Comment <span style={{ color: acting===item.id?'var(--error)':'var(--muted)', textTransform:'none', letterSpacing:0 }}>(required for rejection)</span></label>
            <textarea className="input" value={comment[item.id]??''} onChange={e=>setComment(p=>({...p,[item.id]:e.target.value}))} rows={2} placeholder="Enter comment…" />
          </div>

          <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
            <button className="btn btn-success" onClick={()=>act(item.id,'approve')} disabled={!!acting}>✓ Approve</button>
            <button className="btn btn-warning" onClick={()=>act(item.id,'hold')}    disabled={!!acting}>⏸ Hold</button>
            <button className="btn btn-danger"  onClick={()=>act(item.id,'reject')}  disabled={!!acting}>✕ Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}
