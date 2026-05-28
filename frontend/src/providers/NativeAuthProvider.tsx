'use client'

// tokenCacheReady is initialized at module level in authSession.ts the moment
// that module is imported — no explicit warm-up call needed here.
// This component exists as a named boundary in the tree for future native-only
// providers (push notifications, status bar, etc.).
export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
