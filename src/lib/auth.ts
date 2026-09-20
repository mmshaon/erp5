// src/lib/auth.ts
export type PermLevel = 'none' | 'view_only' | 'submit_only' | 'superuser'

export interface UserPayload {
  id:          string
  username:    string
  email:       string
  full_name:   string
  role:        string
  department?: string
  permissions: Record<string, string>
}

export function isSuperUser(user: UserPayload | null | undefined): boolean {
  if (!user) return false
  if ((user.role as string) === 'superuser') return true
  const fin = user.permissions?.finance as string | undefined
  return fin === 'superuser'
}

export function getPermLevel(user: UserPayload | null | undefined, module: string): PermLevel {
  if (!user) return 'none'
  if (isSuperUser(user)) return 'superuser'
  return (user.permissions?.[module] as PermLevel | undefined) ?? 'none'
}

export function canView(user: UserPayload | null | undefined, module: string): boolean {
  const level = getPermLevel(user, module) as string
  return ['view_only', 'superuser'].includes(level)
}

export function canSubmit(user: UserPayload | null | undefined, module: string): boolean {
  const level = getPermLevel(user, module) as string
  return ['submit_only', 'superuser'].includes(level)
}
