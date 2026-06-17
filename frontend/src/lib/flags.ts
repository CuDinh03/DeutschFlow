'use client'

import { useFeatureFlagEnabled } from 'posthog-js/react'

/**
 * PostHog feature-flag keys (UI 2.0 rollout).
 * `galerie-v2` gates the Galerie 2.0 surface (/v2/*). While OFF, the legacy UI
 * is the only thing real users reach; the /v2 routes still exist for preview.
 */
export const FLAGS = {
  galerieV2: 'galerie-v2',
} as const

/** True when the Galerie 2.0 UI is enabled for the current user. */
export function useGalerieV2(): boolean {
  return useFeatureFlagEnabled(FLAGS.galerieV2) === true
}
