// src/lib/api.ts
const BASE = '/api'

function getToken(): string | null {
  try { return localStorage.getItem('erp_token') } catch { return null }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }

  const res = await fetch(`${BASE}${path}`, opts)

  // Try to parse JSON regardless of status code for error messages
  let data: unknown
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = { error: text || `HTTP ${res.status}` }
  }

  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error ?? `Request failed with status ${res.status}`
    throw new Error(errMsg)
  }

  return data as T
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
}
