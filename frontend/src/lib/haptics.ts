'use client'

type ImpactWeight = 'Light' | 'Medium' | 'Heavy'

// Web haptics via the Vibration API. The Capacitor native plugin was retired (S20b); on the web
// build we fall back to navigator.vibrate, which works on supporting devices (most Android browsers)
// and is a silent no-op elsewhere (desktop, iOS Safari). Never blocks the interaction it accompanies.
const DURATION_MS: Record<ImpactWeight, number> = { Light: 10, Medium: 20, Heavy: 35 }

function fireImpact(weight: ImpactWeight): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(DURATION_MS[weight])
    } catch {
      // Vibration unavailable — ignore.
    }
  }
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
