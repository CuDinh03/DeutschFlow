import { Linking } from 'react-native'

// Canonical legal URLs — the same documents linked from App Store Connect metadata.
// Keep these in sync with the web routes (frontend /privacy, /terms).
export const PRIVACY_POLICY_URL = 'https://mydeutschflow.com/privacy'
export const TERMS_OF_USE_URL = 'https://mydeutschflow.com/terms'

/** Open the privacy policy in the system browser. Best-effort — never throws. */
export function openPrivacyPolicy(): void {
  Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})
}

/** Open the terms of use in the system browser. Best-effort — never throws. */
export function openTermsOfUse(): void {
  Linking.openURL(TERMS_OF_USE_URL).catch(() => {})
}
