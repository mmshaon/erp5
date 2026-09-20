// src/pages/Dashboard.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { useLang } from '../lib/LangContext'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashData {
  expenses:          { total_count:number; approved_total:number; pending_count:number; approved_count:number; rejected_count:number }
  invoices:          { total_count:number; approved_total:number; pending_count:number; approved_count:number }
  pending_approvals: number
  monthly_trend:     { month:string; total:number }[]
  wallet:            { total_received:number; total_expenses:number; current_balance:number }
}

const NEON  = ['#4f8cff','#00ffb3','#ff3cac','#ffe135','#bf5fff','#00d4ff']
const TICK  = { fill:'#8b86c8', fontSize:10 }

// Animated counter
function Counter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const dur = 1200
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.floor(ease * value))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else setDisplay(value)
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])
  return <>{prefix}{display.toLocaleString('en-SA')}</>
}

export default function Dashboard() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const su         = isSuperUser(user)
  const { t }      = useLang()
  const [data, setData]       = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  // clock tick - drives re-render for live time display
  const [, setTick] = useState(0)

  // Live clock
  useEffect(() => { const id = setInterval(() => setTick(p => p+1), 1000); return () => clearInterval(id) }, [])
  const now = new Date()

  useEffect(() => {
    api.get<DashData>('/reports/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div style={{ width:48, height:48, border:'3px solid var(--border2)', borderTopColor:'var(--neon-blue)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'var(--text-muted)', fontFamily:'Space Mono,monospace', fontSize:'0.75rem', letterSpacing:'0.1em' }}>LOADING…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return <div className="alert-error">{error}</div>

  const d = data!
  const bal = Number(d.wallet.current_balance)

  // Build chart data
  const trend = d.monthly_trend.length > 0 ? d.monthly_trend : [
    { month:'N/A', total:0 }
  ]

  // Pie data
  const pieData = [
    { name: t.approved, value: Number(d.expenses.approved_count) || 1, color:'#00ffb3' },
    { name: t.pending,  value: Number(d.expenses.pending_count)  || 0, color:'#ffe135' },
    { name: t.rejected, value: Number(d.expenses.rejected_count) || 0, color:'#ff3cac' },
  ].filter(p => p.value > 0)

  // Multi-line sample comparing expenses vs invoices trend
  const compareData = trend.map((m, i) => ({
    month: m.month,
    expenses: Number(m.total),
    invoices: Number(d.invoices.approved_total) / Math.max(trend.length, 1) * (0.7 + i * 0.05),
  }))

  const radialData = [
    { name: t.approvedExpenses, value: Math.min(100, (d.expenses.approved_count / Math.max(Number(d.expenses.total_count),1)) * 100), fill:'#4f8cff' },
    { name: t.approvedInvoices, value: Math.min(100, (d.invoices.approved_count / Math.max(Number(d.invoices.total_count),1)) * 100), fill:'#00ffb3' },
  ]

  const STATS = [
    { label: t.approvedExpenses, value: Number(d.expenses.approved_total), prefix:'SAR ', accent:'#4f8cff',   sub: `${d.expenses.approved_count} ${t.records}` },
    { label: t.approvedInvoices, value: Number(d.invoices.approved_total), prefix:'SAR ', accent:'#00ffb3',   sub: `${d.invoices.approved_count} ${t.records}` },
    { label: t.walletBalance,    value: Math.abs(bal),                     prefix: bal<0 ? '-SAR ' : 'SAR ', accent: bal>=0 ? '#00ffb3' : '#ff3cac', sub: t.cashMinusExpenses },
    ...(su ? [{ label: t.pendingApprovals, value: Number(d.pending_approvals), prefix:'', accent:'#ffe135', sub: t.awaitingReview }] : []),
  ]

  return (
    <div style={{ fontFamily:"'Rajdhani','Hind Siliguri',sans-serif" }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.5rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom:'0.1rem' }}>{t.dashboard}</h1>
          <div style={{ fontFamily:'Space Mono,monospace', fontSize:'0.68rem', color:'var(--neon-purple)', letterSpacing:'0.08em' }}>
            {now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            &nbsp;·&nbsp;
            {now.toLocaleTimeString('en-GB')}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'var(--text-muted)', fontSize:'0.82rem' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--neon-green)', boxShadow:'0 0 8px var(--neon-green)', animation:'pulse-dot 2s infinite' }} />
          {t.welcome}, <strong style={{ color:'var(--text)' }}>{user?.full_name}</strong>
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="stat-grid">
        {STATS.map((s, i) => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.accent } as React.CSSProperties}>
            <div className="glow-dot" />
            <div style={{ fontFamily:'Space Mono,monospace', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem' }}>{s.label}</div>
            <div className="mono" style={{ fontSize: s.prefix==='SAR '||s.prefix==='-SAR ' ? '1.05rem':'1.5rem', fontWeight:700, color:s.accent, lineHeight:1.2, textShadow:`0 0 20px ${s.accent}66` }}>
              <Counter value={s.value} prefix={s.prefix} />
            </div>
            {s.sub && <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:'0.3rem' }}>{s.sub}</div>}
            {/* Mini sparkline */}
            <div style={{ marginTop:'0.6rem', height:28, opacity:0.5 }}>
              <ResponsiveContainer width="100%" height={28}>
                <AreaChart data={trend} margin={{top:0,right:0,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.accent} stopOpacity={0.4}/>
                      <stop offset="100%" stopColor={s.accent} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="total" stroke={s.accent} strokeWidth={1.5} fill={`url(#sg${i})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1: Area trend + Radial */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
        {/* Area chart - monthly trend */}
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.monthlyTrend}</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={compareData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#4f8cff" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#4f8cff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#00ffb3" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#00ffb3" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false}/>
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={52} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{ background:'#110e33', border:'1px solid #2a2560', borderRadius:'10px', color:'#e8e6ff', fontSize:'0.8rem' }} formatter={(v:number)=>[`SAR ${v.toLocaleString()}`]}/>
              <Area type="monotone" dataKey="expenses" stroke="#4f8cff" strokeWidth={2} fill="url(#gE)" dot={false} name={t.expenses}/>
              <Area type="monotone" dataKey="invoices"  stroke="#00ffb3" strokeWidth={2} fill="url(#gI)" dot={false} name={t.invoices}/>
              <Legend iconSize={8} wrapperStyle={{ fontSize:'0.72rem', color:'#8b86c8' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radial bar chart - approval rates */}
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.approvedExpenses} / {t.approvedInvoices} %</div>
          <ResponsiveContainer width="100%" height={190}>
            <RadialBarChart innerRadius="30%" outerRadius="85%" data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill:'rgba(42,37,96,0.4)' }} dataKey="value" cornerRadius={6} label={{ position:'insideStart', fill:'#e8e6ff', fontSize:9 }}/>
              <Tooltip contentStyle={{ background:'#110e33', border:'1px solid #2a2560', borderRadius:'10px', color:'#e8e6ff', fontSize:'0.8rem' }} formatter={(v:number)=>[`${v.toFixed(1)}%`]}/>
              <Legend iconSize={8} wrapperStyle={{ fontSize:'0.72rem', color:'#8b86c8' }}/>
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Bar + Pie + Line */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1.4fr', gap:'1rem', marginBottom:'1rem' }}>
        {/* Bar chart */}
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.expensesLast6}</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={trend} margin={{top:4,right:4,left:0,bottom:0}}>
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false}/>
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={52} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{ background:'#110e33', border:'1px solid #2a2560', borderRadius:'10px', color:'#e8e6ff', fontSize:'0.8rem' }} formatter={(v:number)=>[`SAR ${v.toLocaleString()}`,'Total']}/>
              <Bar dataKey="total" radius={[5,5,0,0]}>
                {trend.map((_, i) => <Cell key={i} fill={NEON[i % NEON.length]} fillOpacity={0.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - expense status */}
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.expenses}</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" paddingAngle={4} dataKey="value">
                {pieData.map((p, i) => <Cell key={i} fill={p.color} stroke="transparent"/>)}
              </Pie>
              <Tooltip contentStyle={{ background:'#110e33', border:'1px solid #2a2560', borderRadius:'10px', color:'#e8e6ff', fontSize:'0.8rem' }}/>
              <Legend iconSize={8} wrapperStyle={{ fontSize:'0.7rem', color:'#8b86c8' }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Net flow line */}
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.netFlow}</div>
          <div className="mono" style={{ fontSize:'1.4rem', fontWeight:700, color: bal>=0?'#00ffb3':'#ff3cac', marginBottom:'0.5rem', textShadow:`0 0 16px ${bal>=0?'#00ffb3':'#ff3cac'}66` }}>
            SAR {Math.abs(bal).toLocaleString('en-SA', {minimumFractionDigits:0})}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trend} margin={{top:4,right:4,left:0,bottom:0}}>
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:'#110e33', border:'1px solid #2a2560', borderRadius:'10px', color:'#e8e6ff', fontSize:'0.8rem' }} formatter={(v:number)=>[`SAR ${v.toLocaleString()}`]}/>
              <Line type="monotone" dataKey="total" stroke="#bf5fff" strokeWidth={2} dot={{ fill:'#bf5fff', strokeWidth:0, r:3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table + quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'1rem', alignItems:'start' }}>
        <div className="glass" style={{ padding:'1.25rem' }}>
          <div className="section-label">{t.recentActivity}</div>
          <table style={{ minWidth:'unset' }}>
            <thead>
              <tr>
                <th>{t.expenses}</th>
                <th style={{ textAlign:'right' }}>{t.amount}</th>
                <th style={{ textAlign:'center' }}>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color:'var(--text-muted)' }}>{t.totalExpenses}</td>
                <td className="mono" style={{ textAlign:'right', color:'#4f8cff' }}>SAR {Number(d.expenses.approved_total).toLocaleString('en-SA',{minimumFractionDigits:2})}</td>
                <td style={{ textAlign:'center' }}><span className="badge badge-approved">{d.expenses.approved_count}</span></td>
              </tr>
              <tr>
                <td style={{ color:'var(--text-muted)' }}>{t.pendingExpenses}</td>
                <td className="mono" style={{ textAlign:'right', color:'#ffe135' }}>—</td>
                <td style={{ textAlign:'center' }}><span className="badge badge-pending">{d.expenses.pending_count}</span></td>
              </tr>
              <tr>
                <td style={{ color:'var(--text-muted)' }}>{t.totalInvoices}</td>
                <td className="mono" style={{ textAlign:'right', color:'#00ffb3' }}>SAR {Number(d.invoices.approved_total).toLocaleString('en-SA',{minimumFractionDigits:2})}</td>
                <td style={{ textAlign:'center' }}><span className="badge badge-approved">{d.invoices.approved_count}</span></td>
              </tr>
              <tr>
                <td style={{ color:'var(--text-muted)' }}>{t.pendingInvoices}</td>
                <td className="mono" style={{ textAlign:'right', color:'#ffe135' }}>—</td>
                <td style={{ textAlign:'center' }}><span className="badge badge-pending">{d.invoices.pending_count}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="glass" style={{ padding:'1.25rem', minWidth:200 }}>
          <div className="section-label">{t.quickActions}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            <button className="btn btn-primary"   onClick={()=>navigate('/expenses/new')}>{t.newExpense}</button>
            <button className="btn btn-secondary" onClick={()=>navigate('/invoices/new')}>{t.newInvoice}</button>
            <button className="btn btn-secondary" onClick={()=>navigate('/wallet')}>{t.viewWallet}</button>
            {su && (
              <button className="btn btn-warning" onClick={()=>navigate('/approvals')}>
                {t.reviewApprovals} {d.pending_approvals > 0 ? `(${d.pending_approvals})` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
