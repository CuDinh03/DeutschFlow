import { GaLanding } from '@/components/landing-v2/GaLanding'

/**
 * /v2 — the Galerie marketing landing. `.ga-scope`, galerie.css and `force-dynamic`
 * are supplied by the /v2 layout, so this is a thin wrapper around the shared
 * GaLanding component (also rendered as the canonical homepage at `/`).
 */
export default function V2LandingPage() {
  return <GaLanding />
}
