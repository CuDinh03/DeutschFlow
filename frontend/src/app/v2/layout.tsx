import * as React from 'react'
import '@/styles/galerie.css'
import { V2Gate } from './V2Gate'

/**
 * /v2 — Galerie 2.0 surface root. The single `.ga-scope` wrapper activates the
 * UI 2.0 token layer (galerie.css); `ga-*` utilities resolve only inside here,
 * so the legacy UI elsewhere is untouched. `V2Gate` blocks route ACCESS when the
 * `galerie-v2` flag is off (interim; edge middleware lands in Phase 3 pre-cutover).
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ga-scope min-h-screen bg-ga-bg">
      <V2Gate>{children}</V2Gate>
    </div>
  )
}
