// src/pages/ERPLayout.tsx
import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { useLang } from '../lib/LangContext'
import { api } from '../lib/api'
import logoUrl from '../assets/logo.jpg'

interface Notification { id:string; title:string; body:string; is_read:boolean; created_at:string }

export default function ERPLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)
  const { t, lang, toggle } = useLang()
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const d = await api.get<{ notifications: Notification[]; unread_count: number }>('/admin/finance?type=notifications')
      setNotifications(d.notifications)
      setUnread(d.unread_count)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => clearInterval(id)
  }, [fetchNotifications])

  async function markAllRead() {
    try {
      await api.post('/admin/finance?type=mark_read', {})
      setNotifications(p => p.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch { /* non-fatal */ }
  }

  function handleLogout() { logout(); navigate('/login', { replace: true }) }
  function close() { setOpen(false) }

  const NAV = [
    { to: '/',            label: t.dashboard,   icon: '◧', end: true },
    { to: '/expenses',    label: t.expenses,    icon: '◈' },
    { to: '/invoices',    label: t.invoices,    icon: '◉' },
    { to: '/wallet',      label: t.wallet,      icon: '◎' },
    { to: '/approvals',   label: t.approvals,   icon: '✦', super: true },
    { to: '/users',       label: t.users,       icon: '⊞', super: true },
    { to: '/permissions', label: t.permissions, icon: '⬡', super: true },
    { to: '/reports',     label: t.reports,     icon: '▤', super: true },
  ]

  const sidebar = (
    <>
      {/* Brand — uses real logo */}
      <div style={{ padding:'0.85rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'0.7rem', flexShrink:0 }}>
        <img src={logoUrl} alt="Alpha Ultimate" style={{ height:36, width:'auto', borderRadius:6, flexShrink:0 }} />
        <div>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:800, fontSize:'0.82rem', color:'var(--text)', lineHeight:1.1, letterSpacing:'0.05em' }}>ALPHA ULTIMATE</div>
          <div style={{ fontFamily:'Space Mono,monospace', fontWeight:700, fontSize:'0.6rem', color:'var(--neon-blue)', lineHeight:1.1, letterSpacing:'0.06em' }}>ERP SYSTEM</div>
        </div>
      </div>

      {/* Lang toggle */}
      <div style={{ padding:'0.5rem 0.75rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.58rem', color:'var(--muted)', letterSpacing:'0.08em' }}>LANG</span>
        <button className="btn-lang" onClick={toggle}>
          {lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'0.6rem 0', overflowY:'auto' }}>
        {NAV.filter(n => !n.super || su).map(n => (
          <NavLink key={n.to} to={n.to} end={!!n.end} onClick={close}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:'0.6rem',
              padding:'0.62rem 0.9rem', margin:'0.08rem 0.5rem', borderRadius:'8px',
              fontSize:'0.9rem', fontWeight:600, textDecoration:'none',
              fontFamily:"'Rajdhani','Hind Siliguri',sans-serif",
              transition:'all 0.14s',
              background: isActive ? 'rgba(79,140,255,0.14)' : 'transparent',
              color: isActive ? 'var(--neon-blue)' : 'var(--text-muted)',
              borderLeft: `2px solid ${isActive ? 'var(--neon-blue)' : 'transparent'}`,
              boxShadow: isActive ? 'inset 0 0 20px rgba(79,140,255,0.06)' : 'none',
            })}
          >
            <span style={{ fontSize:'0.95rem', width:'1rem', textAlign:'center', flexShrink:0 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer with notification bell */}
      <div style={{ padding:'0.85rem', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        {/* Notification bell */}
        <div style={{ marginBottom:'0.65rem', position:'relative' }}>
          <button
            onClick={() => { setNotifOpen(p => !p); if (!notifOpen && unread > 0) markAllRead() }}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'rgba(79,140,255,0.06)', border:'1px solid rgba(79,140,255,0.2)',
              borderRadius:8, padding:'0.5rem 0.75rem', cursor:'pointer',
              fontFamily:"'Rajdhani',sans-serif", fontSize:'0.82rem', color:'var(--text)',
              transition:'all 0.14s',
            }}
          >
            <span>🔔 Notifications</span>
            {unread > 0 && (
              <span style={{
                background:'var(--neon-pink)', color:'#fff', borderRadius:'50%',
                width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.62rem', fontWeight:700, fontFamily:'Space Mono,monospace',
                animation:'pulse-dot 2s infinite',
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div style={{
              position:'absolute', bottom:'100%', left:0, right:0, marginBottom:4,
              background:'var(--card)', border:'1px solid var(--border)', borderRadius:10,
              maxHeight:280, overflowY:'auto', boxShadow:'0 -8px 32px rgba(0,0,0,0.5)',
              zIndex:200,
            }}>
              <div style={{ padding:'0.6rem 0.8rem', borderBottom:'1px solid var(--border)', fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:'Space Mono,monospace', letterSpacing:'0.07em' }}>
                NOTIFICATIONS
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding:'1rem', textAlign:'center', color:'var(--muted)', fontSize:'0.78rem' }}>All caught up ✓</div>
              ) : notifications.slice(0, 20).map(n => (
                <div key={n.id} style={{
                  padding:'0.6rem 0.8rem', borderBottom:'1px solid rgba(42,37,96,0.4)',
                  background: n.is_read ? 'transparent' : 'rgba(79,140,255,0.04)',
                }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:600, color: n.is_read ? 'var(--text-muted)' : 'var(--text)', marginBottom:'0.15rem' }}>{n.title}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', lineHeight:1.3 }}>{n.body}</div>
                  <div style={{ fontSize:'0.62rem', color:'var(--muted)', marginTop:'0.2rem', fontFamily:'Space Mono,monospace' }}>
                    {new Date(n.created_at).toLocaleString('en-GB')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize:'0.85rem', color:'var(--text)', fontWeight:600, marginBottom:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Rajdhani','Hind Siliguri',sans-serif" }}>
          {user?.full_name}
        </div>
        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:'0.65rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Space Mono,monospace' }}>
          {user?.email}
        </div>
        <span style={{ display:'inline-flex', padding:'0.12rem 0.5rem', background:'rgba(79,140,255,0.12)', border:'1px solid rgba(79,140,255,0.3)', borderRadius:'20px', fontSize:'0.65rem', color:'var(--neon-blue)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.7rem', fontFamily:'Space Mono,monospace' }}>
          {user?.role}
        </span>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ width:'100%', fontSize:'0.82rem', padding:'0.45rem' }}>
          {t.signOut}
        </button>
      </div>
    </>
  )

  return (
    <div className="erp-shell">
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={close} />

      {/* Mobile topbar */}
      <div className="erp-topbar">
        <button onClick={() => setOpen(p => !p)} style={{ background:'none', border:'none', color:'var(--neon-blue)', cursor:'pointer', padding:'0.3rem', fontSize:'1.3rem', lineHeight:1, flexShrink:0 }}>☰</button>
        <img src={logoUrl} alt="Alpha Ultimate" style={{ height:28, width:'auto', borderRadius:4 }} />
        <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:800, fontSize:'0.85rem', color:'var(--text)' }}>
          ALPHA <span style={{ color:'var(--neon-blue)' }}>ULTIMATE</span>
        </span>
        {/* Mobile notification badge */}
        {unread > 0 && (
          <span style={{
            background:'var(--neon-pink)', color:'#fff', borderRadius:'50%',
            width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.62rem', fontWeight:700, fontFamily:'Space Mono,monospace', flexShrink:0,
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
        <button className="btn-lang" style={{ marginLeft:'auto' }} onClick={toggle}>
          {lang === 'en' ? '🇧🇩' : '🇬🇧'}
        </button>
      </div>

      <aside className={`erp-sidebar ${open ? 'open' : ''}`}>{sidebar}</aside>
      <main className="erp-main"><Outlet /></main>
    </div>
  )
}
