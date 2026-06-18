'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useFeatureFlagEnabled } from 'posthog-js/react'
import { FLAGS } from '@/lib/flags'

/**
 * V2Gate — interim route-ACCESS gate for the Galerie 2.0 surface.
 * When `galerie-v2` resolves to an explicit `false`, redirect to the legacy
 * equivalent (strip the `/v2` prefix). `undefined` (flag still loading / PostHog
 * not configured in dev) is treated as "not determined" so preview still works.
 *
 * NOTE: true edge enforcement = middleware.ts matching `/v2/*` (Phase 3, before
 * cutover). This client guard is the down-payment until then.
 */
export function V2Gate({ children }: { children: React.ReactNode }) {
  const enabled = useFeatureFlagEnabled(FLAGS.galerieV2)
  const pathname = usePathname() ?? '/v2'
  const router = useRouter()

  useEffect(() => {
    if (enabled === false) {
      router.replace(pathname.replace(/^\/v2/, '') || '/')
    }
  }, [enabled, pathname, router])

  if (enabled === false) return null
  return <>{children}</>
}
