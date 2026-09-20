// src/pages/LoginPage.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/LangContext'
import logoUrl from '../assets/logo.jpg'

export default function LoginPage() {
  const { login }     = useAuth()
  const navigate      = useNavigate()
  const { lang, toggle } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { setError(lang === 'en' ? 'Username and password required.' : 'ব্যবহারকারীর নাম ও পাসওয়ার্ড প্রয়োজন।'); return }
    setError(''); setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === 'en' ? 'Login failed.' : 'লগইন ব্যর্থ হয়েছে।'))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', position:'relative', overflow:'hidden' }}>
      {/* Animated background orbs */}
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(79,140,255,0.08) 0%, transparent 70%)', top:-100, left:-100, pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(191,95,255,0.06) 0%, transparent 70%)', bottom:-50, right:-50, pointerEvents:'none' }} />

      {/* Lang toggle */}
      <button className="btn-lang" onClick={toggle} style={{ position:'absolute', top:'1.5rem', right:'1.5rem' }}>
        {lang === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
      </button>

      <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        {/* Real logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src={logoUrl} alt="Alpha Ultimate Ltd"
            style={{ height:80, width:'auto', margin:'0 auto 0.85rem', display:'block',
              borderRadius:12, boxShadow:'0 0 40px rgba(79,140,255,0.25)' }} />
          <h1 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'1.8rem', fontWeight:800, color:'var(--text)', margin:0, letterSpacing:'0.08em' }}>ALPHA ULTIMATE</h1>
          <p style={{ fontFamily:'Space Mono,monospace', color:'var(--neon-purple)', fontSize:'0.7rem', marginTop:'0.3rem', letterSpacing:'0.14em' }}>ERP MANAGEMENT SYSTEM</p>
        </div>

        <div className="glass" style={{ padding:'2rem' }}>
          <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:'0 0 1.5rem', letterSpacing:'0.03em' }}>
            {lang === 'en' ? 'Sign in to your account' : 'আপনার অ্যাকাউন্টে প্রবেশ করুন'}
          </h2>

          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom:'1rem' }}>
              <label className="label">{lang === 'en' ? 'Username or Email' : 'ব্যবহারকারীর নাম বা ইমেইল'}</label>
              <input className="input" type="text" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin" required />
            </div>
            <div style={{ marginBottom:'1.5rem' }}>
              <label className="label">{lang === 'en' ? 'Password' : 'পাসওয়ার্ড'}</label>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'0.8rem', fontSize:'1rem' }} disabled={loading}>
              {loading ? (lang==='en'?'Signing in…':'প্রবেশ হচ্ছে…') : (lang==='en'?'Sign In →':'প্রবেশ করুন →')}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', color:'var(--muted)', fontSize:'0.7rem', marginTop:'1.5rem', fontFamily:'Space Mono,monospace' }}>
          © Alpha Ultimate Ltd · Riyadh, KSA
        </p>
      </div>
    </div>
  )
}
