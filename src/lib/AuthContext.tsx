// src/lib/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface UserData {
  id: string
  username: string
  email: string
  full_name: string
  role: string
  department?: string
  permissions: Record<string, string>
}

interface AuthCtx {
  user:   UserData | null
  login:  (username: string, password: string) => Promise<void>
  logout: () => void
  ready:  boolean
}

const Ctx = createContext<AuthCtx>({ user:null, login:async()=>{}, logout:()=>{}, ready:false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,  setUser]  = useState<UserData | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('erp_token')
    const saved = localStorage.getItem('erp_user')
    if (token && saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('erp_token')
        localStorage.removeItem('erp_user')
      }
    }
    setReady(true)
  }, [])

  async function login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    let data: unknown
    try { data = await res.json() } catch { throw new Error('Server error — could not parse response') }

    if (!res.ok) {
      throw new Error((data as { error?: string })?.error ?? `Login failed (${res.status})`)
    }

    const { token, user: userData } = data as { token: string; user: UserData }
    localStorage.setItem('erp_token', token)
    localStorage.setItem('erp_user',  JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, login, logout, ready }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
