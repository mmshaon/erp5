// src/pages/InvoiceFormPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'
import CameraUploadForm from '../components/erp/CameraUploadForm'

interface LineItem { description:string; quantity:string; unit:string; unit_price:string; tax_percent:string }
const EMPTY = (): LineItem => ({ description:'', quantity:'1', unit:'', unit_price:'', tax_percent:'15' })

export default function InvoiceFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = new Date()

  const [lines,       setLines]       = useState<LineItem[]>([EMPTY()])
  const [clientName,  setClientName]  = useState('')
  const [clientAddr,  setClientAddr]  = useState('')
  const [clientVat,   setClientVat]   = useState('')
  const [projectName, setProjectName] = useState('')
  const [poNumber,    setPoNumber]    = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [payTerms,    setPayTerms]    = useState('30 days')
  const [notes,       setNotes]       = useState('')
  const [mediaUrls,   setMediaUrls]   = useState<string[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  const computed = lines.map(l => {
    const sub = parseFloat(l.quantity||'0') * parseFloat(l.unit_price||'0')
    const tax = sub * (parseFloat(l.tax_percent||'0') / 100)
    return { sub, tax, total: sub + tax }
  })
  const grandTotal = computed.reduce((a,c) => a + c.total, 0)
  const fmt = (n: number) => n.toLocaleString('en-SA', { minimumFractionDigits:2, maximumFractionDigits:2 })

  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  async function handleSubmit() {
    if (!clientName.trim())                                 { setError('Client name is required.'); return }
    if (lines.find(l => !l.description.trim() || !l.unit_price.trim())) { setError('Fill Description and Unit Price for every line item.'); return }
    setError(''); setSubmitting(true)
    try {
      await api.post('/invoices', {
        client_name: clientName.trim(), client_address: clientAddr||null, client_vat_number: clientVat||null,
        project_name: projectName||null, po_number: poNumber||null, due_date: dueDate||null,
        payment_terms: payTerms||null, notes: notes||null, media_urls: mediaUrls,
        line_items: lines.map(l => ({
          description: l.description.trim(), quantity: parseFloat(l.quantity)||1,
          unit: l.unit.trim()||null, unit_price: parseFloat(l.unit_price)||0, tax_percent: parseFloat(l.tax_percent)||15,
        })),
      })
      navigate('/invoices', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')}>← Back</button>
        <h1 className="page-title">New Invoice</h1>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Auto-populated */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Auto-populated — Read Only</div>
        <div className="form-grid">
          {[['Date',now.toLocaleDateString('en-GB')],['Time',now.toLocaleTimeString('en-GB')],['User ID',user?.id??'—'],['Prepared By',user?.full_name??'—']].map(([l,v])=>(
            <div className="form-row" key={l}><label className="label">{l}</label><input className="input mono" value={v} disabled readOnly /></div>
          ))}
        </div>
      </div>

      {/* Client */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Client Information</div>
        <div className="form-grid">
          <div className="form-row"><label className="label">Client Name *</label><input className="input" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Company or person name" /></div>
          <div className="form-row"><label className="label">VAT Number</label><input className="input mono" value={clientVat} onChange={e=>setClientVat(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row col-span-2"><label className="label">Client Address</label><input className="input" value={clientAddr} onChange={e=>setClientAddr(e.target.value)} placeholder="Optional" /></div>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Invoice Details</div>
        <div className="form-grid">
          <div className="form-row"><label className="label">Project Name</label><input className="input" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row"><label className="label">PO Number</label><input className="input mono" value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row"><label className="label">Due Date</label><input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>
          <div className="form-row"><label className="label">Payment Terms</label><input className="input" value={payTerms} onChange={e=>setPayTerms(e.target.value)} /></div>
          <div className="form-row col-span-2"><label className="label">Notes</label><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional…" /></div>
        </div>
      </div>

      {/* Line items */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <div className="section-label" style={{ marginBottom:0 }}>Line Items</div>
          <button className="btn btn-secondary btn-sm" onClick={()=>setLines(p=>[...p,EMPTY()])}>+ Add Row</button>
        </div>
        <div className="line-item-headers" style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1.4fr 0.9fr 1.4fr 28px', gap:'0.4rem', marginBottom:'0.4rem' }}>
          {['Description','Qty','Unit','Unit Price','Tax %','Total',''].map(h=>(
            <div key={h} style={{ fontSize:'0.68rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</div>
          ))}
        </div>
        {lines.map((l,i)=>(
          <div key={i} className="line-item-row">
            <input className="input li-desc" value={l.description} onChange={e=>updateLine(i,'description',e.target.value)} placeholder="Description *" style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.quantity}    onChange={e=>updateLine(i,'quantity',e.target.value)}    type="number" min="0" step="0.01" placeholder="1"    style={{ fontSize:'0.9rem' }} />
            <input className="input"         value={l.unit}        onChange={e=>updateLine(i,'unit',e.target.value)}        placeholder="pcs"                                    style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.unit_price}  onChange={e=>updateLine(i,'unit_price',e.target.value)}  type="number" min="0" step="0.01" placeholder="0.00" style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.tax_percent} onChange={e=>updateLine(i,'tax_percent',e.target.value)} type="number" min="0" max="100"   placeholder="15"   style={{ fontSize:'0.9rem' }} />
            <div className="mono li-total" style={{ fontSize:'0.85rem', color:'var(--success)', padding:'0 0.2rem' }}>{fmt(computed[i]?.total??0)}</div>
            <button className="li-delete" onClick={()=>setLines(p=>p.filter((_,idx)=>idx!==i))} disabled={lines.length===1}
              style={{ background:'none', border:'none', color:'var(--error)', cursor:'pointer', padding:'0.2rem', fontSize:'1.2rem', lineHeight:1, opacity:lines.length===1?0.25:1 }}>×</button>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'flex-end', borderTop:'1px solid var(--border)', paddingTop:'1rem', marginTop:'0.5rem' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:'0.25rem' }}>GRAND TOTAL</div>
            <div className="mono" style={{ fontSize:'1.5rem', fontWeight:600, color:'var(--cyan)' }}>SAR {fmt(grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Attachments</div>
        <CameraUploadForm entityType="invoices" onUploaded={files=>setMediaUrls(p=>[...p,...files.map(f=>f.url)])} />
      </div>

      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', paddingBottom:'2rem' }}>
        <button className="btn btn-secondary" onClick={()=>navigate('/invoices')} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary"   onClick={handleSubmit}              disabled={submitting}>{submitting?'Submitting…':'✓ Submit Invoice'}</button>
      </div>
    </div>
  )
}
