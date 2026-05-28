import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// ─── Storage keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY   = 'accessToken'
const REFRESH_TOKEN_KEY  = 'refreshToken'
const LAST_TOKEN_REFRESH_KEY = 'lastTokenRefresh'

// ─── Cookie keys (web only) ───────────────────────────────────────────────────
const AUTH_ACCESS_COOKIE    = 'auth_access'
const AUTH_ROLE_COOKIE      = 'auth_role'
const AUTH_LOGGED_IN_COOKIE = 'auth_logged_in'

// Storage strategy:
//   Web:    access token → sessionStorage, refresh token → HttpOnly cookie (set by backend)
//   Native: access token + refresh token → @capacitor/preferences (native secure storage)
//
// Native mobile clients send X-Platform: ios/android header.
// Backend detects this and returns refreshToken in body instead of HttpOnly cookie.

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** 'ios' | 'android' | 'web' */
export function getPlatform(): string {
  return Capacitor.getPlatform()
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

// ─── Cookie helpers (web only) ────────────────────────────────────────────────

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

// ─── Async native storage ─────────────────────────────────────────────────────

async function nativeGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value
}

async function nativeSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

async function nativeRemove(key: string): Promise<void> {
  await Preferences.remove({ key })
}

// ─── In-memory cache for sync access token reads ──────────────────────────────
// Preferences.get() is async — we keep an in-memory copy so getAccessToken()
// stays synchronous for the axios interceptor.

let _accessTokenCache: string | null = null
let _refreshTokenCache: string | null = null

async function warmTokenCache(): Promise<void> {
  if (!isNative()) return
  _accessTokenCache = await nativeGet(ACCESS_TOKEN_KEY)
  _refreshTokenCache = await nativeGet(REFRESH_TOKEN_KEY)
}

// Initialized at module load time — before any React component renders.
// Web: isNative()=false → resolves immediately (no-op).
// iOS: resolves after Preferences.get() (~10-50ms native bridge).
// Await this before reading tokens on mount to avoid cold-launch redirect-to-login race.
export const tokenCacheReady: Promise<void> = warmTokenCache()

// ─── Public token API ─────────────────────────────────────────────────────────

/** Read the stored access token. Returns null if not signed in. */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  if (isNative()) return _accessTokenCache
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * On web: refresh token is in HttpOnly cookie — always returns null from JS.
 * On native: returns the token stored in Preferences.
 */
export function getRefreshToken(): string | null {
  if (isNative()) return _refreshTokenCache
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

export function isStudentRole(role?: string | null): boolean {
  return normalizeRole(role ?? getAuthRole()) === 'STUDENT'
}

export function shouldShowAiSpeakingQuota(): boolean {
  return !isStudentRole()
}

type AuthLikeResponse = {
  accessToken?: string | null
  refreshToken?: string | null
  role?: string | null
}

/**
 * Persist tokens after login / token refresh.
 *
 * Web:    access token → sessionStorage + cookie, refresh token → HttpOnly cookie (backend)
 * Native: access token + refresh token → @capacitor/preferences
 */
export function setTokens(response: AuthLikeResponse): void {
  const { accessToken, refreshToken, role } = response
  if (!accessToken) {
    throw new Error('No access token in auth response. Login failed. Please try again.')
  }

  const resolvedRole = normalizeRole(role) || getRoleFromToken(accessToken)

  if (isNative()) {
    // Native: store both tokens in-memory and schedule async persist
    _accessTokenCache = accessToken
    _refreshTokenCache = refreshToken ?? null
    void nativeSet(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) void nativeSet(REFRESH_TOKEN_KEY, refreshToken)
    else void nativeRemove(REFRESH_TOKEN_KEY)
    return
  }

  // Web: sessionStorage for access token, HttpOnly cookie for refresh (backend sets it)
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)

  setCookie(AUTH_ACCESS_COOKIE, accessToken, null)
  setCookie(AUTH_ROLE_COOKIE, resolvedRole, null)
  setCookie(AUTH_LOGGED_IN_COOKIE, '1', null)
}

/** Remove all tokens from storage. */
export function clearTokens(): void {
  _accessTokenCache = null
  _refreshTokenCache = null

  if (isNative()) {
    void nativeRemove(ACCESS_TOKEN_KEY)
    void nativeRemove(REFRESH_TOKEN_KEY)
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
    return
  }

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
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isNative() ? { 'X-Platform': getPlatform() } : {}),
        },
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
