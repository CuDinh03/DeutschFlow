export const ACCESS_TOKEN_KEY = "accessToken";

const LEGACY_TOKEN_KEYS = ["access_token", "token", "authToken", "jwt"] as const;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * One-time migration to standardize on ACCESS_TOKEN_KEY.
 * If multiple legacy keys exist, the first non-empty one wins.
 */
export function migrateLegacyTokenKeys(): { migrated: boolean; fromKey?: string } {
  if (typeof window === "undefined") return { migrated: false };

  const existing = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (existing && existing.trim()) {
    // Clean up legacy keys to avoid ambiguity
    for (const k of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(k);
    return { migrated: false };
  }

  for (const k of LEGACY_TOKEN_KEYS) {
    const v = window.localStorage.getItem(k);
    if (v && v.trim()) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, v.trim());
      window.localStorage.removeItem(k);
      // Remove any other legacy keys to avoid mismatch
      for (const kk of LEGACY_TOKEN_KEYS) if (kk !== k) window.localStorage.removeItem(kk);
      return { migrated: true, fromKey: k };
    }
  }
  return { migrated: false };
}

