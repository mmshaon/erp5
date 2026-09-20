// Global type declarations for modules without @types packages

declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'
  interface UserOptions {
    head?: any[][]
    body?: any[][]
    foot?: any[][]
    startY?: number
    theme?: 'striped' | 'grid' | 'plain' | 'css'
    styles?: Record<string, any>
    headStyles?: Record<string, any>
    bodyStyles?: Record<string, any>
    footStyles?: Record<string, any>
    alternateRowStyles?: Record<string, any>
    columnStyles?: Record<string, Record<string, any>>
    margin?: { top?: number; right?: number; bottom?: number; left?: number }
    pageBreak?: 'auto' | 'avoid' | 'always'
    rowPageBreak?: 'auto' | 'avoid'
    tableWidth?: 'auto' | 'wrap' | number
    showHead?: 'everyPage' | 'firstPage' | 'never'
    showFoot?: 'everyPage' | 'lastPage' | 'never'
    tableLineWidth?: number
    tableLineColor?: number | number[]
    didDrawPage?: (data: any) => void
    didParseCell?: (data: any) => void
    willDrawCell?: (data: any) => void
    didDrawCell?: (data: any) => void
  }
  function autoTable(doc: jsPDF, options: UserOptions): void
  export default autoTable
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable: { finalY: number }
    previousAutoTable: { finalY: number }
  }
}
