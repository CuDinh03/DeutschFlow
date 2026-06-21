'use client'

import * as React from 'react'

/**
 * V2Gate — Galerie 2.0 is now the DEFAULT surface (full cutover).
 *
 * Access control lives in middleware.ts: per-role gating of `/v2/*` plus the
 * global `GALERIE_V2_DISABLED` kill-switch (set it to "true" in Amplify env to
 * instantly bounce every `/v2` request back to the legacy surface — the rollback
 * lever for this cutover).
 *
 * This used to gate on the per-user `galerie-v2` PostHog flag, but that flag
 * proved unreliable (person-property propagation + cross-origin flag-reload
 * latency), so the wrapper no longer blocks render. Kept as a passthrough for
 * structural symmetry and as the seam to re-introduce per-user gating later.
 */
export function V2Gate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
