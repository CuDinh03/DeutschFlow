// Jailbreak / root detection scaffold — S13.
//
// GUARDED NO-OP until `jail-monkey` is installed (no native import → Metro keeps bundling).
// Treat the result as a SOFT signal only — never hard-block: rooted/jailbroken devices include
// legitimate power users and CI, and detection is heuristic. Use it to nudge (warn, disable
// high-risk actions, raise a server-side risk flag), not to brick the app.
//
// To ACTIVATE:
//   1. `cd mobile && npx expo install jail-monkey`
//   2. Add `import JailMonkey from 'jail-monkey'` at the top of this file.
//   3. Uncomment the detection block in checkDeviceIntegrity().

export interface DeviceIntegrity {
  /** True if any tamper signal fired. Soft signal — do not hard-block on it. */
  compromised: boolean
  /** Which signals fired (e.g. 'jailbroken_or_rooted', 'mock_location', 'hook_detected'). */
  signals: string[]
}

export function checkDeviceIntegrity(): DeviceIntegrity {
  // --- ACTIVATE: uncomment after `npx expo install jail-monkey` ---
  // const signals: string[] = []
  // if (JailMonkey.isJailBroken()) signals.push('jailbroken_or_rooted')
  // if (JailMonkey.hookDetected?.()) signals.push('hook_detected')
  // if (JailMonkey.canMockLocation?.()) signals.push('mock_location')
  // if (JailMonkey.isOnExternalStorage?.()) signals.push('external_storage')
  // return { compromised: signals.length > 0, signals }
  return { compromised: false, signals: [] }
}

/** Bootstrap hook: log a dev warning when a tamper signal fires (no-op until activated). */
export function initDeviceIntegrity(): void {
  const result = checkDeviceIntegrity()
  if (result.compromised && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[deviceIntegrity] tamper signals:', result.signals.join(', '))
  }
}
