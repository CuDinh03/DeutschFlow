// ─── Storage keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY  = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'   // kept only for legacy cleanup
const LAST_TOKEN_REFRESH_KEY = 'lastTokenRefresh'

// Storage strategy (post-HttpOnly migration):
//   Access token  → sessionStorage (tab-scoped, short-lived — safe for JS access)
//   Refresh token → HttpOnly cookie set by backend (JS cannot read — XSS-safe)
//
// Browser sends the HttpOnly cookie automatically when calling /api/auth/refresh.
// No localStorage for refresh token anymore.

const AUTH_ACCESS_COOKIE   = 'auth_access'
const AUTH_ROLE_COOKIE     = 'auth_role'
const AUTH_LOGGED_IN_COOKIE = 'auth_logged_in'

// BUG FIX #1: Session keep-alive configuration
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // Refresh every 5 minutes
const TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000    // Refresh 2 minutes before expiry

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
  // Thêm Secure flag khi chạy trên HTTPS (prod/staging).
  // Bỏ qua ở localhost (HTTP) để không break local dev.
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  let cookieStr = `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`
  if (isSecure) cookieStr += ';Secure'
  if (maxAgeSeconds !== null) {
    cookieStr += `;max-age=${maxAgeSeconds}`
  }
  document.cookie = cookieStr
}

// ─── Public token API ─────────────────────────────────────────────────────────

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Current app role from cookie or JWT (defaults to STUDENT). */
export function getAuthRole(): string {
  const fromCookie = normalizeRole(readCookie(AUTH_ROLE_COOKIE))
  if (fromCookie) return fromCookie
  const token = getAccessToken()
  if (token) return getRoleFromToken(token)
  return 'STUDENT'
}

export function isStudentRole(role?: string | null): boolean {
  return normalizeRole(role ?? getAuthRole()) === 'STUDENT'
}

/** AI speaking quota pill — hidden for students. */
export function shouldShowAiSpeakingQuota(): boolean {
  return !isStudentRole()
}

/** Read the stored access token. Returns null if not signed in. */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Refresh token is now stored in an HttpOnly cookie set by the backend.
 * JS cannot read it — the browser sends it automatically on /api/auth/refresh requests.
 *
 * This function always returns null after the HttpOnly cookie migration.
 * Kept for backwards compatibility with any code that still calls it;
 * callers should NOT gate the refresh call on this returning non-null.
 *
 * @deprecated Refresh token is in HttpOnly cookie — JS cannot and should not read it.
 */
export function getRefreshToken(): string | null {
  // Legacy: some browsers may still have an old token in localStorage from before migration.
  // We intentionally do NOT use it — the HttpOnly cookie is authoritative.
  return null
}

/**
 * Persist tokens to sessionStorage AND sync cookies for Next.js middleware.
 * Call this after every successful login / token refresh.
 */
export function setTokens(response: AuthLikeResponse): void {
  const { accessToken, refreshToken, role } = response
  if (!accessToken) {
    throw new Error('No access token in auth response. Login failed. Please try again.')
  }

  // Access token → sessionStorage (tab-scoped, wiped on close — short-lived is fine)
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  // Clean up old access token from localStorage (migration)
  localStorage.removeItem(ACCESS_TOKEN_KEY)

  // Refresh token is now in an HttpOnly cookie set by the backend — not stored in JS.
  // Clean up any legacy token that may linger in storage from before the migration.
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)

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
  const ts = Date.now()
  console.log('[DF_TRACE][authSession.clearTokens:start]', {
    ts,
    accessTokenExists: Boolean(getAccessToken()),
    refreshTokenExists: Boolean(getRefreshToken()),
    stack: new Error().stack,
  })
  // Clear access token from sessionStorage
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  // Clear refresh token from BOTH storages (belt-and-suspenders)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  // Clean up legacy access token location
  localStorage.removeItem(ACCESS_TOKEN_KEY)

  // Clear ALL sessionStorage keys (wipe any cached API data)
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
  console.log('[DF_TRACE][authSession.clearTokens:done]', { ts: Date.now() })
}

/**
 * Full logout: revoke refresh token on server, clear local state,
 * then hard-reload to /login to wipe all React in-memory state.
 * Use this instead of calling clearTokens() + router.push().
 */
export async function logout(): Promise<void> {
  try {
    const token = getAccessToken()
    if (token) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        // credentials: 'include' — gửi HttpOnly refresh_token cookie để backend xóa
        credentials: 'include',
        signal: AbortSignal.timeout(3000),
      })
    }
  } catch {
    // ignore network errors — still clear locally
  }
  clearTokens()
  window.location.href = '/login'
}

// BUG FIX #1: Session keep-alive mechanism
/**
 * Track the last token refresh time to prevent excessive refresh calls
 */
export function recordTokenRefresh(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(LAST_TOKEN_REFRESH_KEY, String(Date.now()))
  }
}

/**
 * Check if token needs proactive refresh based on time since last refresh
 */
export function shouldRefreshToken(): boolean {
  if (typeof window === 'undefined') return false
  const lastRefresh = sessionStorage.getItem(LAST_TOKEN_REFRESH_KEY)
  if (!lastRefresh) return false
  const timeSinceLastRefresh = Date.now() - parseInt(lastRefresh, 10)
  return timeSinceLastRefresh > TOKEN_REFRESH_INTERVAL_MS
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
