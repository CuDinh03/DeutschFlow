// Learning companion for the skill tree — a small mascot that perches on the
// recommended-next lesson. The choice persists via expo-secure-store (spec C3:
// the design's web localStorage does not exist in RN; @react-native-async-storage
// is not installed; expo-secure-store already ships in the app). Mirrors the
// load-on-mount / persist-on-change idiom of lib/theme/ThemeProvider + onboardingDraft.

import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'lt_companion' // valid SecureStore key: matches /^[\w.-]+$/

export type CompanionKey = 'owl' | 'bird' | 'butterfly' | 'squirrel' | 'none'

export const COMPANIONS: { key: CompanionKey; label: string; emoji: string | null }[] = [
  { key: 'owl', label: 'Cú', emoji: '🦉' },
  { key: 'bird', label: 'Chim', emoji: '🐦' },
  { key: 'butterfly', label: 'Bướm', emoji: '🦋' },
  { key: 'squirrel', label: 'Sóc', emoji: '🐿️' },
  { key: 'none', label: 'Không', emoji: null },
]

const DEFAULT_COMPANION: CompanionKey = 'owl'
const VALID = new Set<CompanionKey>(COMPANIONS.map((c) => c.key))

function isCompanionKey(v: string | null): v is CompanionKey {
  return v !== null && VALID.has(v as CompanionKey)
}

export function companionEmoji(key: CompanionKey): string | null {
  return COMPANIONS.find((c) => c.key === key)?.emoji ?? null
}

// Seeds with the default so the first paint never flashes, hydrates the persisted
// value on mount, and fire-and-forget persists on change (errors swallowed, as in
// the repo's other SecureStore call sites).
export function useCompanion(): { companion: CompanionKey; setCompanion: (next: CompanionKey) => void } {
  const [companion, setCompanionState] = useState<CompanionKey>(DEFAULT_COMPANION)

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (isCompanionKey(stored)) setCompanionState(stored)
      })
      .catch(() => {})
  }, [])

  const setCompanion = (next: CompanionKey) => {
    setCompanionState(next)
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {})
  }

  return { companion, setCompanion }
}
