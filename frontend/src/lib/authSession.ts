// Web-only auth session storage.
//
// Storage strategy (web):
//   access token  → sessionStorage + a mirror cookie (auth_access) read by middleware
//   refresh token → HttpOnly cookie set by the backend (never readable from JS)
//
// NOTE: The Capacitor native path (tokens in @capacitor/preferences — unencrypted
// UserDefaults/SharedPreferences) was REMOVED here as part of retiring the legacy Capacitor
// build (S20). The canonical native app is the Expo `mobile/` client, which stores tokens in
// expo-secure-store (Keychain/Keystore) via its own mobile/lib/auth.ts. isNative()/getPlatform()
// are kept as web-only stubs so existing callers (e.g. lib/api.ts) keep compiling.

// ─── Storage keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY   = 'accessToken'
const REFRESH_TOKEN_KEY  = 'refreshToken'
const LAST_TOKEN_REFRESH_KEY = 'lastTokenRefresh'

// ─── Cookie keys ──────────────────────────────────────────────────────────────
const AUTH_ACCESS_COOKIE    = 'auth_access'
const AUTH_ROLE_COOKIE      = 'auth_role'
// Org role (OWNER|ADMIN|TEACHER|STUDENT) is a SEPARATE claim from the global role. Mirrored to a
// cookie alongside auth_role so the client can read it without decoding the JWT. Empty for B2C users.
const AUTH_ORG_ROLE_COOKIE  = 'auth_org_role'
const AUTH_LOGGED_IN_COOKIE = 'auth_logged_in'

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/** Web build is never a native platform. Kept for backward-compat with existing callers. */
export function isNative(): boolean {
  return false
}

/** Always 'web' for this build. Kept for backward-compat with existing callers. */
export function getPlatform(): string {
  return 'web'
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

function getOrgRoleFromToken(accessToken: string): string {
  const payload = decodeJwtPayload(accessToken)
  return normalizeRole(typeof payload?.orgRole === 'string' ? payload.orgRole : '')
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, maxAgeSeconds: number | null): void {
  if (typeof window === 'undefined') return
  const isSecure = window.location.protocol === 'https:'
  let cookieStr = `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`
  if (isSecure) cookieStr += ';Secure'
  if (maxAgeSeconds !== null) cookieStr += `;max-age=${maxAgeSeconds}`
  document.cookie = cookieStr
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

// ─── Cold-start readiness ───────────────────────────────────────────────────────
// Web reads tokens synchronously from sessionStorage, so there is nothing to warm.
// Kept (resolved) so callers that `await tokenCacheReady` on mount keep working.
export const tokenCacheReady: Promise<void> = Promise.resolve()

// ─── Public token API ─────────────────────────────────────────────────────────

/** Read the stored access token. Returns null if not signed in. */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Refresh token lives in an HttpOnly cookie on web — never readable from JS. */
export function getRefreshToken(): string | null {
  return null
}

/** Current app role from cookie or JWT (defaults to STUDENT). */
export function getAuthRole(): string {
  const fromCookie = normalizeRole(readCookie(AUTH_ROLE_COOKIE))
  if (fromCookie) return fromCookie
  const token = getAccessToken()
  if (token) return getRoleFromToken(token)
  return 'STUDENT'
}

/**
 * Org role (OWNER|ADMIN|TEACHER|STUDENT) from cookie or JWT, or '' for B2C / non-org users.
 * Separate from getAuthRole(): an org owner is global TEACHER but OWNER inside the org.
 */
export function getOrgRole(): string {
  const fromCookie = normalizeRole(readCookie(AUTH_ORG_ROLE_COOKIE))
  if (fromCookie) return fromCookie
  const token = getAccessToken()
  if (token) return getOrgRoleFromToken(token)
  return ''
}

export function isStudentRole(role?: string | null): boolean {
  return normalizeRole(role ?? getAuthRole()) === 'STUDENT'
}

export function shouldShowAiSpeakingQuota(): boolean {
  return isStudentRole()
}

type AuthLikeResponse = {
  accessToken?: string | null
  refreshToken?: string | null
  role?: string | null
  orgRole?: string | null
  orgId?: number | null
}

/**
 * Persist tokens after login / token refresh.
 * Access token → sessionStorage + mirror cookie; refresh token → HttpOnly cookie (backend-set).
 */
export function setTokens(response: AuthLikeResponse): void {
  const { accessToken, role, orgRole } = response
  if (!accessToken) {
    throw new Error('No access token in auth response. Login failed. Please try again.')
  }

  const resolvedRole = normalizeRole(role) || getRoleFromToken(accessToken)
  // Prefer the explicit AuthResponse field; fall back to the JWT claim. '' for B2C / non-org users.
  const resolvedOrgRole = normalizeRole(orgRole) || getOrgRoleFromToken(accessToken)

  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)

  setCookie(AUTH_ACCESS_COOKIE, accessToken, null)
  setCookie(AUTH_ROLE_COOKIE, resolvedRole, null)
  setCookie(AUTH_ORG_ROLE_COOKIE, resolvedOrgRole, null)
  setCookie(AUTH_LOGGED_IN_COOKIE, '1', null)
}

/** Remove all tokens from storage. */
export function clearTokens(): void {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)

  const keysToRemove: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key) keysToRemove.push(key)
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k))

  setCookie(AUTH_ACCESS_COOKIE, '', 0)
  setCookie(AUTH_ROLE_COOKIE, '', 0)
  setCookie(AUTH_ORG_ROLE_COOKIE, '', 0)
  setCookie(AUTH_LOGGED_IN_COOKIE, '', 0)
}

/** Full logout: revoke server-side, clear local state, redirect to /login. */
export async function logout(): Promise<void> {
  try {
    const token = getAccessToken()
    if (token) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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

// ─── Session keep-alive ───────────────────────────────────────────────────────

export function recordTokenRefresh(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(LAST_TOKEN_REFRESH_KEY, String(Date.now()))
  }
}

export function shouldRefreshToken(): boolean {
  if (typeof window === 'undefined') return false
  const lastRefresh = sessionStorage.getItem(LAST_TOKEN_REFRESH_KEY)
  if (!lastRefresh) return false
  return Date.now() - parseInt(lastRefresh, 10) > TOKEN_REFRESH_INTERVAL_MS
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────

/** @deprecated Use setTokens() instead */
export function syncAuthCookies(payload: { accessToken?: string | null; role?: string | null }): void {
  setTokens(payload)
}

/** @deprecated Use clearTokens() instead */
export function clearAuthCookies(): void {
  clearTokens()
}
