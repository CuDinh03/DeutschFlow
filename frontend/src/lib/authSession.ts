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

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase()
}

function getRoleFromToken(accessToken: string): string {
  const payload = decodeJwtPayload(accessToken)
  const fromClaim = normalizeRole(typeof payload?.role === 'string' ? payload.role : '')
  return fromClaim || 'STUDENT'
}

function setCookie(name: string, value: string, maxAgeSeconds: number | null): void {
  let cookieStr = `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`
  if (maxAgeSeconds !== null) {
    cookieStr += `;max-age=${maxAgeSeconds}`
  }
  document.cookie = cookieStr
}

// ─── Public token API ─────────────────────────────────────────────────────────

/** Read the stored access token. Returns null if not signed in. */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Read the stored refresh token. */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Persist tokens to sessionStorage AND sync cookies for Next.js middleware.
 * Call this after every successful login / token refresh.
 */
export function setTokens(response: AuthLikeResponse): void {
  const { accessToken, refreshToken, role } = response
  if (!accessToken) return

  // Save to sessionStorage (main token store for current session)
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)

  // Remove them from localStorage if they exist (migration/cleanup)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)

  // Sync cookies so Next.js middleware can read role without client JS
  // Using null maxAge makes them Session Cookies (wiped when browser closes)
  const resolvedRole = normalizeRole(role) || getRoleFromToken(accessToken)
  setCookie(AUTH_ACCESS_COOKIE, accessToken, null)
  setCookie(AUTH_ROLE_COOKIE, resolvedRole, null)
  setCookie(AUTH_LOGGED_IN_COOKIE, '1', null)
}

/**
 * Remove tokens from both sessionStorage, localStorage, and cookies.
 * Call this on every logout path.
 */
export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  
  // Clear ALL sessionStorage keys
  const keysToRemove: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key) keysToRemove.push(key)
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k))
  
  // Clear cookies
  setCookie(AUTH_ACCESS_COOKIE, '', 0)
  setCookie(AUTH_ROLE_COOKIE, '', 0)
  setCookie(AUTH_LOGGED_IN_COOKIE, '', 0)
}

/**
 * Full logout: revoke refresh token on server, clear local state,
 * then hard-reload to /login to wipe all React in-memory state.
 * Use this instead of calling clearTokens() + router.push().
 */
export async function logout(): Promise<void> {
  // 1. Revoke refresh token on the backend (best-effort, don't block on error)
  try {
    const token = getAccessToken()
    if (token) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      })
    }
  } catch {
    // ignore network errors — still clear locally
  }
  // 2. Clear all local tokens and storage
  clearTokens()
  // 3. Hard redirect — reloads the page, wiping ALL React state
  window.location.href = '/login'
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
