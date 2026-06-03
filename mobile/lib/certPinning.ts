/**
 * TLS certificate (SPKI public-key) pinning scaffold — S12. **DISABLED by default.**
 *
 * Why disabled: `api.mydeutschflow.com` is served by **Let's Encrypt**, which rotates LEAF certs
 * every ~60-90 days. Pinning the leaf alone WILL brick the app at renewal. Enabling pinning safely
 * requires:
 *   - pinning a STABLE key (the ISRG Root X1 SPKI) plus at least one backup pin, AND
 *   - shipping pin updates BEFORE the certificate changes, AND
 *   - on-device verification (a wrong pin blocks ALL network traffic).
 *
 * To ACTIVATE:
 *   1. `npx expo install react-native-ssl-public-key-pinning`
 *   2. Add its Expo config plugin to app.json `plugins` (see docs/security/PHASE1_MOBILE_HARDENING.md).
 *   3. Recompute pins with `mobile/scripts/compute-spki-pins.sh`, put ≥2 into PUBLIC_KEY_HASHES.
 *   4. Add `import { initializeSslPinning } from 'react-native-ssl-public-key-pinning'` at the top
 *      and uncomment the call below.
 *   5. Set CERT_PINNING_ENABLED = true and verify on a physical device before release.
 */
export const CERT_PINNING_ENABLED = false

export const PINNED_HOST = 'api.mydeutschflow.com'

// SPKI SHA-256 (base64) pins — recompute with scripts/compute-spki-pins.sh before each rotation.
// Computed 2026-06-03 (reference only; uncomment + verify, and add the stable root, before enabling):
export const PUBLIC_KEY_HASHES: string[] = [
  // 'qUi/Vy2PN0FAFuJSJ+wqKk4w7UceGYcq4ayxcP3S4LU=', // LEAF CN=api.mydeutschflow.com — rotates, do NOT rely on alone
  // 'iFvwVyJSxnQdyaUvUERIf+8qk7gRze3612JMwoO3zdU=', // Let's Encrypt E8 intermediate — rotates occasionally
  // '<ISRG Root X1 SPKI>',                          // STABLE root — compute & verify, use as primary pin
]

export function initCertPinning(): void {
  if (!CERT_PINNING_ENABLED || PUBLIC_KEY_HASHES.length < 2) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[certPinning] disabled (scaffold) — needs the lib + ≥2 verified pins to enable.')
    }
    return
  }

  // --- ACTIVATE: uncomment after installing react-native-ssl-public-key-pinning ---
  // void initializeSslPinning({
  //   [PINNED_HOST]: { includeSubdomains: false, publicKeyHashes: PUBLIC_KEY_HASHES },
  // })
}
