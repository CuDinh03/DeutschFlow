'use client'

import { Capacitor } from '@capacitor/core'

type ImpactWeight = 'Light' | 'Medium' | 'Heavy'

// Fire-and-forget haptic. No-op on web and if the plugin is unavailable —
// never blocks the UI interaction it accompanies.
function fireImpact(weight: ImpactWeight): void {
  if (!Capacitor.isNativePlatform()) return

  void (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle[weight] })
    } catch {
      // Plugin unavailable — ignore.
    }
  })()
}

/** Subtle tap — buttons, selections, mic toggle. */
export function lightImpact(): void {
  fireImpact('Light')
}

/** Firmer tap — confirmations, correct answers, card flips. */
export function mediumImpact(): void {
  fireImpact('Medium')
}

/** Strong tap — errors, wrong answers, destructive actions. */
export function heavyImpact(): void {
  fireImpact('Heavy')
}
