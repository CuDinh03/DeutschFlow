import * as SecureStore from 'expo-secure-store'

// One-time (revocable) consent for sharing user content with third-party AI services.
//
// App Store Review 5.1.1(i)/5.1.2(i): before ANY user data (voice recordings, photos of
// written work, conversation text) is sent to a third-party AI provider (Groq, OpenAI,
// Google Gemini), the app must (a) disclose exactly what is sent and to whom, and
// (b) obtain the user's permission. Every entry point that captures content destined
// for an AI endpoint must call `ensureAiConsent()` FIRST and abort when it returns false.
//
// The disclosure UI itself lives in `components/AiConsentSheet.tsx`, mounted once in the
// root layout; this module is the tiny imperative bridge + persistence.

const KEY = 'df_ai_consent_v1'

export type AiConsentStatus = 'granted' | 'denied' | 'unset'

let cached: AiConsentStatus | null = null

/** Read the persisted consent decision. */
export async function getAiConsent(): Promise<AiConsentStatus> {
  if (cached) return cached
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    cached = raw === 'granted' ? 'granted' : raw === 'denied' ? 'denied' : 'unset'
  } catch {
    cached = 'unset'
  }
  return cached
}

/** Persist the user's decision. Best-effort — an unsaved decision simply re-asks next time. */
export async function setAiConsent(granted: boolean): Promise<void> {
  cached = granted ? 'granted' : 'denied'
  try {
    await SecureStore.setItemAsync(KEY, cached)
  } catch {
    /* storage unavailable — we'll ask again next launch */
  }
}

/** Reset to unset (used by the profile "quyền riêng tư" row so users can change their mind). */
export async function resetAiConsent(): Promise<void> {
  cached = 'unset'
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    /* ignore */
  }
}

// ── Imperative bridge to the modal host ─────────────────────────────────────
// AiConsentSheet registers a presenter on mount; feature code awaits ensureAiConsent().

type Presenter = () => Promise<boolean>

let presenter: Presenter | null = null

export function registerAiConsentPresenter(p: Presenter | null): void {
  presenter = p
}

/**
 * Gate for every AI-bound capture (record audio, pick/shoot a photo for grading, AI chat).
 * Returns true when the user has granted consent — either previously or via the sheet just
 * now. A prior "denied" is NOT terminal: we re-present the sheet so the user can opt in later.
 */
export async function ensureAiConsent(): Promise<boolean> {
  const status = await getAiConsent()
  if (status === 'granted') return true
  if (!presenter) return false
  return presenter()
}
