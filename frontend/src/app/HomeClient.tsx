'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import { homeFor } from '@/lib/roleRouting'
import { GaLanding } from '@/components/landing-v2/GaLanding'

/**
 * HomeClient — renders the marketing landing for web visitors and owns the
 * client-side routing that the legacy landing did:
 *
 * - Web with a valid token: revalidate via /auth/me, then land on that user's
 *   role home; clear stale tokens on failure (the landing then stays visible).
 *
 * There is no native branch: this is the WEB build (authSession#isNative is a
 * hardcoded `false` stub), and the Expo `mobile/` client renders its own screens
 * rather than loading this page in a webview.
 *
 * /auth/me returns the full AuthResponse (backend AuthService#me), so BOTH `role`
 * and `orgRole` come off that one call — orgRole is what keeps a legacy
 * role=TEACHER centre manager out of the teacher home and in the org console.
 *
 * GaLanding renders deterministically, so it is server-rendered (no blank-flash
 * guard) — good for SEO and first paint; the redirect above fires after hydration.
 */
export default function HomeClient() {
  const router = useRouter()

  useEffect(() => {
    if (getAccessToken()) {
      api
        .get('/auth/me')
        .then(({ data }) => router.replace(homeFor(data.role, { orgRole: data.orgRole })))
        .catch(() => clearTokens())
    }
  }, [router])

  return <GaLanding />
}
