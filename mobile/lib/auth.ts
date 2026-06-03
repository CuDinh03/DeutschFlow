import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'df_access_token'
const REFRESH_TOKEN_KEY = 'df_refresh_token'
const USER_ROLE_KEY = 'df_user_role'

// Keep tokens device-local on iOS: WHEN_UNLOCKED_THIS_DEVICE_ONLY excludes them from iCloud
// Keychain sync and encrypted backups, so a refresh token can't leak to another device via backup.
// (keychainAccessible is iOS-only; expo-secure-store ignores it on Android, which is device-bound.)
const TOKEN_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export async function setTokens(access: string, refresh?: string | null): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access, TOKEN_STORE_OPTIONS)
  // SecureStore throws on null/undefined values — only persist the refresh token when present.
  if (refresh) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh, TOKEN_STORE_OPTIONS)
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ROLE_KEY),
  ])
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
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

export function getRoleFromToken(token: string): string {
  const payload = decodeJwtPayload(token)
  return typeof payload?.role === 'string' ? payload.role.toUpperCase() : 'STUDENT'
}
