// src/components/admin/ERPExpenseForm.tsx
// Alpha Ultimate ERP — Immutable Expense Form with Camera Upload
// - Auto-populates Date, Time, User ID, User Name from JWT (readOnly/disabled)
// - Dynamic multi-line items: Description, Qty, Unit, Unit Price, Tax%, Total
// - Camera/file upload: 10 MB per file, 25 MB total payload
// - On submit → POST to /api/admin/finance?type=expenses → redirect away
// - Submit-only users are ROUTED AWAY after submit and cannot return to view

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useNavigate }  from 'react-router-dom'
import { useAuth }      from '../../lib/AuthContext'
import { api }          from '../../lib/api'
import logoUrl          from '../../assets/logo.jpg'

// ── Types ─────────────────────────────────────────────────────
interface LineItem {
  description: string
  quantity:    string
  unit:        string
  unit_price:  string
  tax_percent: string
}

interface StagedFile {
  name:    string
  size:    number
  type:    string
  dataUrl: string
  preview: string | null
}

interface UploadedFile {
  id:        string | null
  name:      string
  url:       string
  thumb_url: string | null
  type:      string
}

// ── Constants ─────────────────────────────────────────────────
const MAX_FILE_MB    = 10
const MAX_TOTAL_MB   = 25
const MAX_FILE_BYTES = MAX_FILE_MB  * 1024 * 1024
const MAX_TOT_BYTES  = MAX_TOTAL_MB * 1024 * 1024

const EMPTY_LINE = (): LineItem => ({
  description: '', quantity: '1', unit: '', unit_price: '', tax_percent: '15',
})

const CATEGORIES = [
  { id: '', name: '— Select Category —' },
  { id: 'mat', name: 'Materials & Supplies' },
  { id: 'lab', name: 'Labour & Wages' },
  { id: 'eqp', name: 'Equipment & Tools' },
  { id: 'trn', name: 'Transport & Fuel' },
  { id: 'utl', name: 'Utilities' },
  { id: 'ofc', name: 'Office & Admin' },
  { id: 'mnt', name: 'Maintenance & Repairs' },
  { id: 'saf', name: 'Safety & PPE' },
  { id: 'msc', name: 'Miscellaneous' },
]

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcLine(l: LineItem) {
  const sub = parseFloat(l.quantity || '0') * parseFloat(l.unit_price || '0')
  const tax = sub * (parseFloat(l.tax_percent || '0') / 100)
  return { sub: isNaN(sub) ? 0 : sub, tax: isNaN(tax) ? 0 : tax, total: isNaN(sub + tax) ? 0 : sub + tax }
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Component ─────────────────────────────────────────────────
export default function ERPExpenseForm() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const fileRef    = useRef<HTMLInputElement>(null)

  // Immutable timestamp locked at form mount
  const mountTime  = useRef(new Date())
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const liveTime = new Date()

  // Form state
  const [lines,       setLines]      = useState<LineItem[]>([EMPTY_LINE()])
  const [projectName, setProject]    = useState('')
  const [projectLoc,  setLocation]   = useState('')
  const [categoryId,  setCategoryId] = useState('')
  const [notes,       setNotes]      = useState('')

  // Upload state
  const [staged,    setStaged]    = useState<StagedFile[]>([])
  const [uploaded,  setUploaded]  = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // ── Computed totals ────────────────────────────────────────
  const computed   = lines.map(calcLine)
  const grandTotal = computed.reduce((a, c) => a + c.total, 0)
  const taxTotal   = computed.reduce((a, c) => a + c.tax,   0)
  const subTotal   = computed.reduce((a, c) => a + c.sub,   0)

  // Staged total bytes
  const stagedBytes = staged.reduce((a, f) => a + f.size, 0)

  // ── Line item helpers ──────────────────────────────────────
  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }
  function addLine()    { setLines(p => [...p, EMPTY_LINE()]) }
  function removeLine(i: number) {
    if (lines.length === 1) return
    setLines(p => p.filter((_, idx) => idx !== i))
  }

  // ── File selection ─────────────────────────────────────────
  function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    setUploadErr('')
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    let running = stagedBytes
    const toAdd: StagedFile[] = []

    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        setUploadErr(`"${f.name}" exceeds the ${MAX_FILE_MB} MB per-file limit.`)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      if (running + f.size > MAX_TOT_BYTES) {
        setUploadErr(`Adding "${f.name}" would exceed the ${MAX_TOTAL_MB} MB total payload limit.`)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      running += f.size
      toAdd.push({ name: f.name, size: f.size, type: f.type, dataUrl: '', preview: null })
    }

    // Read files as base64
    toAdd.forEach((item, relIdx) => {
      const file = files[relIdx]
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        setStaged(prev => {
          const copy = [...prev]
          const absIdx = prev.length - toAdd.length + relIdx
          if (copy[absIdx]) {
            copy[absIdx] = {
              ...copy[absIdx],
              dataUrl: result,
              preview: file.type.startsWith('image/') ? result : null,
            }
          }
          return copy
        })
      }
      reader.readAsDataURL(file)
    })

    setStaged(p => [...p, ...toAdd])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeStagedFile(i: number) {
    setStaged(p => p.filter((_, idx) => idx !== i))
  }

  // ── Upload staged files to ImgBB ───────────────────────────
  async function uploadFiles() {
    if (!staged.length) return
    setUploading(true)
    setUploadErr('')
    try {
      // Wait for all base64 reads to complete
      const ready = staged.filter(f => f.dataUrl)
      if (ready.length !== staged.length) {
        setUploadErr('Files are still loading, please wait a moment and try again.')
        setUploading(false)
        return
      }

      const payload = ready.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        data: f.dataUrl.split(',')[1], // strip data:xxx;base64, prefix
      }))

      const result = await api.post<{ uploaded: UploadedFile[] }>('/uploads/imgbb', {
        files:       payload,
        entity_type: 'expenses',
      })

      setUploaded(p => [...p, ...result.uploaded])
      setStaged([])
    } catch (err: unknown) {
      setUploadErr(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  // ── Form submit ────────────────────────────────────────────
  async function handleSubmit() {
    // Validation
    for (const l of lines) {
      if (!l.description.trim()) { setError('Every line item must have a description.'); return }
      if (!l.unit_price.trim() || parseFloat(l.unit_price) <= 0) {
        setError('Every line item must have a valid Unit Price greater than 0.')
        return
      }
    }
    // Warn about un-uploaded staged files
    if (staged.length) {
      setError('You have pending files. Click "Upload Files" before submitting.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await api.post('/admin/finance?type=expenses', {
        project_name:     projectName || null,
        project_location: projectLoc  || null,
        category_id:      categoryId  || null,
        notes:            notes       || null,
        media_urls:       uploaded.map(f => f.url),
        line_items:       lines.map(l => ({
          description: l.description.trim(),
          quantity:    parseFloat(l.quantity)    || 1,
          unit:        l.unit.trim()             || null,
          unit_price:  parseFloat(l.unit_price)  || 0,
          tax_percent: parseFloat(l.tax_percent) || 15,
        })),
      })
      // Submission lock — navigate away immediately, no return
      navigate('/expenses', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 980 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/expenses')}>← Back</button>
        <img src={logoUrl} alt="Alpha Ultimate" style={{ height: 36, width: 'auto', borderRadius: 6 }} />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>New Expense Form</h1>
          <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            ALPHA ULTIMATE LTD · CR: 1234567890 · RIYADH, KSA
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* ── Section 1: Auto-populated (immutable) ── */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Auto-populated — Read Only</div>
          <span style={{
            fontSize: '0.62rem', fontFamily: 'Space Mono,monospace', fontWeight: 700,
            padding: '0.1rem 0.45rem', borderRadius: 20, letterSpacing: '0.05em',
            background: 'rgba(0,255,179,0.1)', border: '1px solid rgba(0,255,179,0.3)', color: 'var(--neon-green)',
          }}>LOCKED</span>
        </div>
        <div className="form-grid">
          {[
            ['Submission Date', mountTime.current.toLocaleDateString('en-GB')],
            ['Submission Time', liveTime.toLocaleTimeString('en-GB')],
            ['User ID',         user?.id      ?? '—'],
            ['Submitted By',    user?.full_name ?? '—'],
            ['Email',           user?.email   ?? '—'],
            ['Department',      user?.department ?? 'General'],
          ].map(([label, value]) => (
            <div className="form-row" key={label}>
              <label className="label">{label}</label>
              <input className="input mono" value={value} disabled readOnly
                style={{ fontSize: '0.85rem', cursor: 'not-allowed', opacity: 0.65 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Project Details ── */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div className="section-label">Project Details</div>
        <div className="form-grid">
          <div className="form-row">
            <label className="label">Project Name</label>
            <input className="input" value={projectName} onChange={e => setProject(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-row">
            <label className="label">Project Location / Site</label>
            <input className="input" value={projectLoc} onChange={e => setLocation(e.target.value)} placeholder="Optional" />
          </div>
          <div className="form-row">
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row col-span-2">
            <label className="label">Notes / Remarks</label>
            <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>
      </div>

      {/* ── Section 3: Line Items ── */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            Line Items <span style={{ color: 'var(--error)', marginLeft: 2 }}>*</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>+ Add Row</button>
        </div>

        {/* Desktop header */}
        <div className="line-item-headers" style={{
          display: 'grid',
          gridTemplateColumns: '3fr 1fr 0.8fr 1.4fr 0.8fr 1.4fr 28px',
          gap: '0.4rem', marginBottom: '0.4rem',
        }}>
          {['Description *', 'Qty', 'Unit', 'Unit Price (SAR) *', 'Tax %', 'Total (SAR)', ''].map(h => (
            <div key={h} style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {lines.map((l, i) => (
          <div key={i} className="line-item-row" style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr 0.8fr 1.4fr 0.8fr 1.4fr 28px',
            gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem',
          }}>
            <input className="input li-desc" value={l.description}
              onChange={e => updateLine(i, 'description', e.target.value)}
              placeholder="Description *" style={{ fontSize: '0.9rem' }} />
            <input className="input mono" value={l.quantity}
              onChange={e => updateLine(i, 'quantity', e.target.value)}
              type="number" min="0" step="0.001" placeholder="1"
              style={{ fontSize: '0.9rem' }} />
            <input className="input" value={l.unit}
              onChange={e => updateLine(i, 'unit', e.target.value)}
              placeholder="pcs" style={{ fontSize: '0.9rem' }} />
            <input className="input mono" value={l.unit_price}
              onChange={e => updateLine(i, 'unit_price', e.target.value)}
              type="number" min="0" step="0.01" placeholder="0.00 *"
              style={{ fontSize: '0.9rem' }} />
            <input className="input mono" value={l.tax_percent}
              onChange={e => updateLine(i, 'tax_percent', e.target.value)}
              type="number" min="0" max="100" placeholder="15"
              style={{ fontSize: '0.9rem' }} />
            <div className="mono li-total" style={{ fontSize: '0.85rem', color: 'var(--success)', padding: '0 0.2rem', fontWeight: 600 }}>
              {fmt(computed[i]?.total ?? 0)}
            </div>
            <button onClick={() => removeLine(i)} disabled={lines.length === 1}
              style={{
                background: 'none', border: 'none', color: 'var(--error)',
                cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                padding: '0.2rem', fontSize: '1.2rem', lineHeight: 1,
                opacity: lines.length === 1 ? 0.2 : 0.8,
              }}>×</button>
          </div>
        ))}

        {/* Totals summary */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem', gap: '0.3rem',
        }}>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span className="mono" style={{ color: 'var(--text)' }}>SAR {fmt(subTotal)}</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>VAT ({lines[0]?.tax_percent || 15}%)</span>
            <span className="mono" style={{ color: 'var(--neon-yellow)' }}>SAR {fmt(taxTotal)}</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.3rem' }}>
            <span style={{ color: 'var(--text)' }}>GRAND TOTAL</span>
            <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--cyan)' }}>SAR {fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Section 4: Camera / File Upload ── */}
      <div className="glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div className="section-label">Receipts & Attachments</div>

        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.85rem', flexWrap: 'wrap', fontFamily: 'Space Mono,monospace' }}>
          <span>Max {MAX_FILE_MB} MB per file</span>
          <span>·</span>
          <span>Max {MAX_TOTAL_MB} MB total</span>
          <span>·</span>
          <span>Images, PDF, DOCX, XLSX, TXT, ZIP</span>
          <span>·</span>
          <span style={{ color: stagedBytes > MAX_TOT_BYTES * 0.8 ? 'var(--warning)' : 'inherit' }}>
            Used: {humanSize(stagedBytes)} / {MAX_TOTAL_MB} MB
          </span>
        </div>

        {uploadErr && <div className="alert-error" style={{ marginBottom: '0.85rem' }}>{uploadErr}</div>}

        {/* Hidden input — uses capture="environment" for mobile camera */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.docx,.xlsx,.txt,.zip"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={onFilePick}
        />

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            📷 Camera / File
          </button>
          {staged.length > 0 && (
            <button className="btn btn-primary" onClick={uploadFiles} disabled={uploading}>
              {uploading ? 'Uploading…' : `⬆ Upload ${staged.length} File${staged.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>

        {/* Staged files (not yet uploaded) */}
        {staged.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {staged.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,225,53,0.06)', border: '1px solid rgba(255,225,53,0.25)',
                borderRadius: 8, padding: '0.5rem 0.65rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                {f.preview
                  ? <img src={f.preview} alt={f.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                  : <div style={{ width: 36, height: 36, background: 'rgba(255,225,53,0.12)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📄</div>
                }
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neon-yellow)', fontFamily: 'Space Mono,monospace' }}>{humanSize(f.size)} · Pending upload</div>
                </div>
                <button onClick={() => removeStagedFile(i)}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0.1rem', marginLeft: 4 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded files (CDN URLs confirmed) */}
        {uploaded.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {uploaded.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{
                background: 'rgba(0,255,179,0.06)', border: '1px solid rgba(0,255,179,0.25)',
                borderRadius: 8, padding: '0.5rem 0.65rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none',
              }}>
                {f.thumb_url
                  ? <img src={f.thumb_url} alt={f.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                  : <div style={{ width: 36, height: 36, background: 'rgba(0,255,179,0.12)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>✓</div>
                }
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--neon-green)', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Space Mono,monospace' }}>Uploaded ✓</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingBottom: '2.5rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/expenses')} disabled={submitting}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || uploading}>
          {submitting ? 'Submitting…' : '✓ Submit Expense'}
        </button>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .line-item-headers { display: none !important; }
          .line-item-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            background: rgba(7,6,26,0.7);
            border: 1px solid var(--border);
            border-radius: 8px; padding: 0.75rem; gap: 0.5rem;
            margin-bottom: 0.75rem; position: relative;
          }
          .line-item-row .li-desc  { grid-column: 1 / -1; }
          .line-item-row .li-total { grid-column: 1 / 2; }
          .line-item-row button    { position: absolute; top: 0.5rem; right: 0.5rem; }
        }
      `}</style>
    </div>
  )
}
