'use client'

import * as React from 'react'

/**
 * V2Gate — Galerie 2.0 is now the DEFAULT surface (full cutover).
 *
 * Access control lives in middleware.ts: per-role gating of `/v2/*`. The global
 * `GALERIE_V2_DISABLED` kill-switch that used to sit alongside it is GONE — it
 * bounced `/v2/*` to the legacy surface, which now collides with the
 * `/login` → `/v2/login` redirect in next.config and loops forever. Rollback is a
 * revert / Amplify "Redeploy this version".
 *
 * This used to gate on the per-user `galerie-v2` PostHog flag, but that flag
 * proved unreliable (person-property propagation + cross-origin flag-reload
 * latency), so the wrapper no longer blocks render. Kept as a passthrough for
 * structural symmetry and as the seam to re-introduce per-user gating later.
 */
export function V2Gate({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
