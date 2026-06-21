'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import { isNative } from '@/lib/native'
import { GaLanding } from '@/components/landing-v2/GaLanding'

/**
 * HomeClient — renders the marketing landing for web visitors and owns the
 * client-side routing that the legacy landing did:
 *
 * - Native shell (Expo webview): never shows the marketing page. Returning users
 *   with a token go to /dashboard, otherwise /login — the native AppDelegate
 *   overlay owns splash + onboarding + auth choice.
 * - Web with a valid token: revalidate via /auth/me then go to /dashboard; clear
 *   stale tokens on failure (then the landing stays visible).
 *
 * GaLanding renders deterministically, so it is server-rendered (no blank-flash
 * guard) — good for SEO and first paint; the redirects above fire after hydration.
 */
export default function HomeClient() {
  const router = useRouter()

  useEffect(() => {
    if (isNative()) {
      router.replace(getAccessToken() ? '/dashboard' : '/login')
      return
    }

    if (getAccessToken()) {
      api
        .get('/auth/me')
        .then(() => router.replace('/dashboard'))
        .catch(() => clearTokens())
    }
  }, [router])

  return <GaLanding />
}
