const AUTH_ACCESS_COOKIE = 'auth_access'
const AUTH_ROLE_COOKIE = 'auth_role'
const AUTH_LOGGED_IN_COOKIE = 'auth_logged_in'

type AuthLikeResponse = {
  accessToken?: string | null
  role?: string | null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function getTokenExpirySeconds(token: string): number {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    const now = Math.floor(Date.now() / 1000)
    return Math.max(60, exp - now)
  }
  return 15 * 60
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase()
}

function getRoleFromToken(accessToken: string): string {
  const payload = decodeJwtPayload(accessToken)
  const fromClaim = normalizeRole(typeof payload?.role === 'string' ? payload.role : '')
  return fromClaim || 'STUDENT'
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAgeSeconds};SameSite=Lax`
}

export function syncAuthCookies(payload: AuthLikeResponse): void {
  const accessToken = payload.accessToken
  if (!accessToken) return

  const maxAge = getTokenExpirySeconds(accessToken)
  const role = normalizeRole(payload.role) || getRoleFromToken(accessToken)

  setCookie(AUTH_ACCESS_COOKIE, accessToken, maxAge)
  setCookie(AUTH_ROLE_COOKIE, role, maxAge)
  setCookie(AUTH_LOGGED_IN_COOKIE, '1', maxAge)
}

export function clearAuthCookies(): void {
  setCookie(AUTH_ACCESS_COOKIE, '', 0)
  setCookie(AUTH_ROLE_COOKIE, '', 0)
  setCookie(AUTH_LOGGED_IN_COOKIE, '', 0)
}

