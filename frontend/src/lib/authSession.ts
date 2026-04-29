// ─── Storage keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY  = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

const AUTH_ACCESS_COOKIE   = 'auth_access'
const AUTH_ROLE_COOKIE     = 'auth_role'
const AUTH_LOGGED_IN_COOKIE = 'auth_logged_in'

type AuthLikeResponse = {
  accessToken?: string | null
  refreshToken?: string | null
  role?: string | null
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

function getTokenExpirySeconds(token: string): number {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    return Math.max(60, exp - Math.floor(Date.now() / 1000))
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

// ─── Public token API ─────────────────────────────────────────────────────────

/** Read the stored access token. Returns null if not signed in. */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Read the stored refresh token. */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Persist tokens to localStorage AND sync cookies for Next.js middleware.
 * Call this after every successful login / token refresh.
 */
export function setTokens(response: AuthLikeResponse): void {
  const { accessToken, refreshToken, role } = response
  if (!accessToken) return

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)

  // Sync cookies so Next.js middleware can read role without client JS
  const maxAge = getTokenExpirySeconds(accessToken)
  const resolvedRole = normalizeRole(role) || getRoleFromToken(accessToken)
  setCookie(AUTH_ACCESS_COOKIE, accessToken, maxAge)
  setCookie(AUTH_ROLE_COOKIE, resolvedRole, maxAge)
  setCookie(AUTH_LOGGED_IN_COOKIE, '1', maxAge)
}

/**
 * Remove tokens from both localStorage and cookies.
 * Call this on every logout path.
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  setCookie(AUTH_ACCESS_COOKIE, '', 0)
  setCookie(AUTH_ROLE_COOKIE, '', 0)
  setCookie(AUTH_LOGGED_IN_COOKIE, '', 0)
}

// ─── Legacy aliases (kept for backward compat) ───────────────────────────────

/** @deprecated Use setTokens() instead */
export function syncAuthCookies(payload: { accessToken?: string | null; role?: string | null }): void {
  setTokens(payload)
}

/** @deprecated Use clearTokens() instead */
export function clearAuthCookies(): void {
  clearTokens()
}
