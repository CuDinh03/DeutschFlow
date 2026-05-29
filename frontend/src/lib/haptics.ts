'use client'

import { Capacitor } from '@capacitor/core'

/**
 * Fire a light haptic tap. No-op on web and if the plugin is unavailable.
 * Fire-and-forget — never blocks the UI interaction it accompanies.
 */
export function lightImpact(): void {
  if (!Capacitor.isNativePlatform()) return

  void (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      // Plugin unavailable — ignore.
    }
  })()
}
