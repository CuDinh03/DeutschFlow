import * as React from 'react'
import '@/styles/galerie.css'
import { V2Gate } from './V2Gate'

/**
 * /v2 — Galerie 2.0 surface root. The single `.ga-scope` wrapper activates the
 * UI 2.0 token layer (galerie.css); `ga-*` utilities resolve only inside here,
 * so the legacy UI elsewhere is untouched.
 *
 * `force-dynamic`: the /v2 pages must NOT be statically prerendered and served
 * with Next's default `Cache-Control: s-maxage=31536000` (1 year). That long
 * cache pinned a stale shell (old chunk refs) on Amplify/CloudFront, so code
 * changes under /v2 (e.g. the V2Gate cutover) never reached users even after a
 * successful deploy. Dynamic rendering keeps the whole v2 surface served fresh.
 */
export const dynamic = 'force-dynamic'

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ga-scope min-h-screen bg-ga-bg">
      <V2Gate>{children}</V2Gate>
    </div>
  )
}
