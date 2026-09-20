// src/pages/ReportsPage.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { useLang } from '../lib/LangContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface Expense {
  form_number:string; submitted_by_name:string; project_name:string
  grand_total:number; status:string; submitted_at:string
}
interface Invoice {
  invoice_number:string; submitted_by_name:string; client_name:string
  grand_total:number; status:string; submitted_at:string
  payment_terms?:string; due_date?:string; notes?:string
}

export default function ReportsPage() {
  const { user }  = useAuth()
  const su        = isSuperUser(user)
  const { t }     = useLang()

  const [expenses,  setExpenses]  = useState<Expense[]>([])
  const [invoices,  setInvoices]  = useState<Invoice[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!su) { setLoading(false); return }
    Promise.all([
      api.get<{ expenses:Expense[] }>('/expenses'),
      api.get<{ invoices:Invoice[] }>('/invoices'),
    ])
      .then(([e,i]) => { setExpenses(e.expenses); setInvoices(i.invoices) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [su])

  const num  = (n:number) => Number(n).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})
  const sar  = (n:number) => `SAR ${num(n)}`
  const date = (s:string) => new Date(s).toLocaleDateString('en-GB')

  // ── Excel export ──────────────────────────────────────────────
  function exportXLSX() {
    setExporting(true)
    try {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        expenses.map(e => ({ 'Form #':e.form_number, 'Submitted By':e.submitted_by_name, 'Project':e.project_name||'', 'Total (SAR)':Number(e.grand_total), 'Status':e.status, 'Date':date(e.submitted_at) }))
      ), 'Expenses')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        invoices.map(i => ({ 'Invoice #':i.invoice_number, 'Submitted By':i.submitted_by_name, 'Client':i.client_name, 'Total (SAR)':Number(i.grand_total), 'Status':i.status, 'Date':date(i.submitted_at) }))
      ), 'Invoices')
      XLSX.writeFile(wb, `Alpha-Ultimate-Report-${new Date().toISOString().slice(0,10)}.xlsx`)
    } finally { setExporting(false) }
  }

  // ── Professional invoice-styled PDF ───────────────────────────
  function exportPDF() {
    setExporting(true)
    try {
      const doc     = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const pw      = doc.internal.pageSize.getWidth()
      const ph      = doc.internal.pageSize.getHeight()
      const nowStr  = new Date().toLocaleDateString('en-GB')
      const fileDate= new Date().toISOString().slice(0,10)

      // ── COLOUR PALETTE (matching the green invoice design) ────
      const GREEN    = [34, 139, 34]   as [number,number,number]
      const DARK     = [30,  30,  30]  as [number,number,number]
      const LIGHT_BG = [245,255,245]   as [number,number,number]
      const WHITE    = [255,255,255]   as [number,number,number]
      const GREY_TXT = [100,100,100]   as [number,number,number]

      // ── HELPER: draw a page for each invoice ──────────────────
      const drawInvoicePage = (inv: Invoice, idx: number) => {
        if (idx > 0) doc.addPage()

        // Left green sidebar
        doc.setFillColor(...GREEN)
        doc.rect(0, 0, 42, ph, 'F')

        // Rotated "INVOICE" text on sidebar
        doc.setTextColor(...WHITE)
        doc.setFontSize(22)
        doc.setFont('helvetica','bold')
        doc.text('INVOICE', 21, ph - 28, { angle: 90, align:'center' })

        // Logo area (top-left in sidebar)
        doc.setFillColor(255,255,255,0.15)
        doc.roundedRect(5, 8, 32, 22, 3, 3, 'F')
        doc.setTextColor(...WHITE)
        doc.setFontSize(9)
        doc.setFont('helvetica','bold')
        doc.text('YOUR', 21, 16, { align:'center' })
        doc.text('LOGO', 21, 22, { align:'center' })

        // Meta on sidebar
        doc.setFontSize(6.5)
        doc.setFont('helvetica','normal')
        const sideMeta = [
          `Invoice # ${inv.invoice_number}`,
          `Date: ${date(inv.submitted_at)}`,
          inv.due_date ? `Due: ${inv.due_date}` : '',
        ].filter(Boolean)
        sideMeta.forEach((line, i) => doc.text(line, 21, 42 + i*7, { align:'center' }))

        // Phone/address at bottom of sidebar
        doc.setFontSize(6)
        doc.text('+966 XX XXX XXXX', 21, ph - 70, { align:'center' })
        doc.text('alpha.ultimate@email.com', 21, ph - 63, { align:'center' })
        doc.text('Riyadh, Saudi Arabia', 21, ph - 56, { align:'center' })

        // Terms at very bottom of sidebar
        doc.setFontSize(5.5)
        doc.setFont('helvetica','bold')
        doc.text('TERMS & CONDITIONS', 21, ph - 45, { align:'center' })
        doc.setFont('helvetica','normal')
        doc.text(inv.payment_terms || 'Net 30 days', 21, ph - 39, { align:'center' })

        // ── Right content area ──────────────────────────────────
        const lx = 48 // left margin of content area

        // Header — From / To
        doc.setTextColor(...DARK)
        doc.setFontSize(8)
        doc.setFont('helvetica','bold')
        doc.text(t.invoiceFrom, lx, 16)
        doc.text(t.invoiceTo, pw/2 + 5, 16)

        doc.setFontSize(14)
        doc.setTextColor(...GREEN)
        doc.text('ALPHA ULTIMATE LTD', lx, 25)
        doc.text(inv.client_name.toUpperCase().slice(0,20), pw/2 + 5, 25)

        doc.setFontSize(7.5)
        doc.setTextColor(...GREY_TXT)
        doc.setFont('helvetica','normal')
        const fromLines = ['Phone: +966 XX XXX XXXX', 'Email: alpha@company.com', 'CR: [Your CR Number]', 'Riyadh, Saudi Arabia']
        fromLines.forEach((l,i) => doc.text(l, lx, 31 + i*5))

        const toLines = [`Submitted By: ${inv.submitted_by_name}`, `Status: ${inv.status.toUpperCase()}`]
        toLines.forEach((l,i) => doc.text(l, pw/2 + 5, 31 + i*5))

        // Divider
        doc.setDrawColor(...GREEN)
        doc.setLineWidth(0.4)
        doc.line(lx, 55, pw - 8, 55)

        // ── Line items table ────────────────────────────────────
        autoTable(doc, {
          startY: 58,
          margin: { left: lx, right: 8 },
          head: [[t.itemDescription, t.qty, t.unitPrice, `${t.tax} (15%)`, t.total]],
          body: [
            [inv.client_name, '1', sar(Number(inv.grand_total)/1.15), sar(Number(inv.grand_total)*0.15/1.15), sar(Number(inv.grand_total))],
          ],
          headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8, fontStyle:'bold', cellPadding: 3 },
          bodyStyles: { fontSize: 8, textColor: DARK, cellPadding: 3 },
          alternateRowStyles: { fillColor: LIGHT_BG },
          columnStyles: { 0:{ cellWidth:'auto' }, 1:{ cellWidth:18, halign:'center' }, 2:{ cellWidth:32, halign:'right' }, 3:{ cellWidth:32, halign:'right' }, 4:{ cellWidth:35, halign:'right' } },
        })

        const docAny  = doc as unknown as { lastAutoTable:{ finalY:number } }
        const afterTbl = docAny.lastAutoTable.finalY + 4

        // ── Totals box (right-aligned) ──────────────────────────
        const sub   = Number(inv.grand_total) / 1.15
        const tax   = Number(inv.grand_total) - sub
        const total = Number(inv.grand_total)
        const totX  = pw - 75

        doc.setFontSize(8); doc.setTextColor(...GREY_TXT)
        ;[
          [t.subtotal,  sar(sub)],
          [`${t.tax} (15%)`, sar(tax)],
        ].forEach(([l, v], i) => {
          doc.text(String(l), totX + 2, afterTbl + 6 + i*7)
          doc.text(String(v), pw - 10, afterTbl + 6 + i*7, { align:'right' })
        })

        // Grand total highlight box
        const gtY = afterTbl + 22
        doc.setFillColor(...GREEN)
        doc.roundedRect(totX - 2, gtY, 68, 12, 2, 2, 'F')
        doc.setTextColor(...WHITE)
        doc.setFontSize(11); doc.setFont('helvetica','bold')
        doc.text(t.grandTotal, totX + 3, gtY + 8)
        doc.text(sar(total), pw - 10, gtY + 8, { align:'right' })

        // ── Payment info ────────────────────────────────────────
        const piY = gtY + 20
        doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(8)
        doc.text(t.paymentInfo, lx, piY)
        doc.setFont('helvetica','normal'); doc.setTextColor(...GREY_TXT); doc.setFontSize(7)
        const piLines = ['Bank: [Your Bank Name]', 'IBAN: [Your IBAN]', 'Account: Alpha Ultimate Ltd']
        piLines.forEach((l,i) => doc.text(l, lx, piY + 6 + i*5))

        // Notes
        if (inv.notes) {
          doc.setTextColor(...GREY_TXT); doc.setFontSize(7)
          doc.text(`Note: ${inv.notes.slice(0,80)}`, lx, piY + 28)
        }

        // ── Footer banner ───────────────────────────────────────
        doc.setFillColor(...GREEN)
        doc.rect(42, ph - 16, pw - 42, 16, 'F')
        doc.setTextColor(...WHITE); doc.setFontSize(11); doc.setFont('helvetica','bold')
        doc.text(t.thanksBusiness, pw/2 + 20, ph - 6, { align:'center' })
      }

      // ── SECTION 1: Expense report page ────────────────────────
      // Cover page
      doc.setFillColor(7, 6, 26)
      doc.rect(0, 0, pw, ph, 'F')

      // Green accent bar
      doc.setFillColor(...GREEN)
      doc.rect(0, 0, pw, 8, 'F')
      doc.rect(0, ph - 8, pw, 8, 'F')

      doc.setTextColor(...WHITE)
      doc.setFontSize(32); doc.setFont('helvetica','bold')
      doc.text('ALPHA ULTIMATE', pw/2, 55, { align:'center' })
      doc.setFontSize(14); doc.setFont('helvetica','normal')
      doc.setTextColor(...GREEN)
      doc.text('FINANCIAL REPORT', pw/2, 66, { align:'center' })
      doc.setFontSize(9); doc.setTextColor(180,180,180)
      doc.text(`Generated: ${nowStr}  ·  ${expenses.length} Expenses  ·  ${invoices.length} Invoices`, pw/2, 76, { align:'center' })

      // Summary stats on cover
      const coverStats = [
        { label:'Total Expenses', value: sar(expenses.reduce((a,e)=>a+Number(e.grand_total),0)) },
        { label:'Total Invoices', value: sar(invoices.reduce((a,i)=>a+Number(i.grand_total),0)) },
        { label:'Approved',       value: String(expenses.filter(e=>e.status==='approved').length + invoices.filter(i=>i.status==='approved').length) },
        { label:'Pending',        value: String(expenses.filter(e=>e.status==='pending').length + invoices.filter(i=>i.status==='pending').length) },
      ]
      coverStats.forEach((s, i) => {
        const x = 20 + i * (pw-10)/4
        doc.setFillColor(30, 30, 60)
        doc.roundedRect(x, 90, (pw-50)/4, 28, 3, 3, 'F')
        doc.setFillColor(...GREEN)
        doc.roundedRect(x, 90, (pw-50)/4, 3, 1, 1, 'F')
        doc.setTextColor(180,180,180); doc.setFontSize(6.5); doc.setFont('helvetica','normal')
        doc.text(s.label, x + (pw-50)/8, 98, { align:'center' })
        doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont('helvetica','bold')
        doc.text(s.value, x + (pw-50)/8, 111, { align:'center' })
      })

      // ── Expense list table on cover page ──────────────────────
      if (expenses.length > 0) {
        doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont('helvetica','bold')
        doc.text('EXPENSES SUMMARY', 14, 135)
        autoTable(doc, {
          startY: 139,
          margin: { left:14, right:14 },
          head: [['Form #','Submitted By','Project','Total (SAR)','Status','Date']],
          body: expenses.map(e => [e.form_number, e.submitted_by_name, e.project_name||'—', sar(e.grand_total), e.status.toUpperCase(), date(e.submitted_at)]),
          headStyles: { fillColor: GREEN, textColor: WHITE, fontSize:7.5, fontStyle:'bold' },
          bodyStyles: { fontSize:7, textColor:WHITE, fillColor:[20,18,50] },
          alternateRowStyles: { fillColor:[13,11,43] },
        })
      }

      // ── Per-invoice pages ──────────────────────────────────────
      invoices.forEach((inv, i) => drawInvoicePage(inv, i))

      // ── Fallback if no invoices ────────────────────────────────
      if (invoices.length === 0) {
        doc.addPage()
        doc.setFillColor(7,6,26); doc.rect(0,0,pw,ph,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(12); doc.setFont('helvetica','italic')
        doc.text('No invoices to display.', pw/2, ph/2, { align:'center' })
      }

      doc.save(`Alpha-Ultimate-FinancialReport-${fileDate}.pdf`)
    } finally { setExporting(false) }
  }

  if (!su) return (
    <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>
      {t.reports} — superuser only
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <h1 className="page-title">{t.reports}</h1>
        <div style={{ display:'flex', gap:'0.65rem', flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={exportXLSX} disabled={exporting||loading}>{t.exportExcel}</button>
          <button className="btn btn-primary"   onClick={exportPDF}  disabled={exporting||loading}>{t.exportPDF}</button>
        </div>
      </div>

      {error   && <div className="alert-error">{error}</div>}
      {loading && <div style={{ color:'var(--text-muted)', padding:'1rem' }}>{t.loading}</div>}

      {!loading && (
        <>
          <div className="stat-grid" style={{ marginBottom:'1.25rem' }}>
            {[
              { label:t.totalExpenses,    value:sar(expenses.reduce((a,e)=>a+Number(e.grand_total),0)) },
              { label:t.approvedExpenses, value:sar(expenses.filter(e=>e.status==='approved').reduce((a,e)=>a+Number(e.grand_total),0)) },
              { label:t.totalInvoices,    value:sar(invoices.reduce((a,i)=>a+Number(i.grand_total),0)) },
              { label:t.approvedInvoices, value:sar(invoices.filter(i=>i.status==='approved').reduce((a,i)=>a+Number(i.grand_total),0)) },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.4rem', fontFamily:'Space Mono,monospace' }}>{s.label}</div>
                <div className="mono" style={{ fontSize:'1rem', fontWeight:700, color:'var(--neon-blue)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="glass table-wrap" style={{ marginBottom:'1.25rem' }}>
            <div style={{ padding:'1rem 1rem 0' }}><div className="section-label">{t.allExpenses}</div></div>
            <table>
              <thead><tr><th>Form #</th><th>Submitted By</th><th>Project</th><th>{t.total}</th><th>{t.status}</th><th>{t.date}</th></tr></thead>
              <tbody>
                {expenses.length===0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>—</td></tr>}
                {expenses.map((e,i)=>(
                  <tr key={i}>
                    <td><span className="mono" style={{ color:'var(--neon-blue)', fontSize:'0.82rem' }}>{e.form_number}</span></td>
                    <td>{e.submitted_by_name}</td>
                    <td style={{ color:'var(--text-muted)' }}>{e.project_name||'—'}</td>
                    <td><span className="mono">{sar(e.grand_total)}</span></td>
                    <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                    <td style={{ color:'var(--muted)', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{date(e.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass table-wrap">
            <div style={{ padding:'1rem 1rem 0' }}><div className="section-label">{t.allInvoices}</div></div>
            <table>
              <thead><tr><th>Invoice #</th><th>Submitted By</th><th>Client</th><th>{t.total}</th><th>{t.status}</th><th>{t.date}</th></tr></thead>
              <tbody>
                {invoices.length===0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>—</td></tr>}
                {invoices.map((inv,i)=>(
                  <tr key={i}>
                    <td><span className="mono" style={{ color:'var(--neon-blue)', fontSize:'0.82rem' }}>{inv.invoice_number}</span></td>
                    <td>{inv.submitted_by_name}</td>
                    <td>{inv.client_name}</td>
                    <td><span className="mono">{sar(inv.grand_total)}</span></td>
                    <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                    <td style={{ color:'var(--muted)', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{date(inv.submitted_at)}</td>
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
