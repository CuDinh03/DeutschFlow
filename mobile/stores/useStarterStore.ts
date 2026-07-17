import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

// Tuần-đầu "Bắt đầu" checklist state (onboarding v1 §7.1) — per-device, best-effort.
// Server-derived items (học chặng đầu) come from queries the home screen already
// runs; THIS store only tracks the signals the backend can't tell us cheaply:
// first spoken sentence, SRS reviews (capped at the checklist target), first
// speaking session, study reminder opt-in, and the card's final dismissal.

export const SRS_CHECKLIST_TARGET = 5

const KEYS = {
  spoke: 'df_starter_spoke',
  srs: 'df_starter_srs_reviews',
  speaking: 'df_starter_speaking',
  reminder: 'df_starter_reminder_on',
  dismissed: 'df_starter_dismissed',
  reminderDeclinedAt: 'df_starter_reminder_declined_at',
} as const

interface StarterState {
  hydrated: boolean
  /** Học viên đã NÓI câu đầu tiên (celebrate ở first-sentence — skip không tính). */
  spokeFirstSentence: boolean
  /** Số thẻ SRS đã ôn, đếm tới SRS_CHECKLIST_TARGET rồi dừng. */
  srsReviews: number
  speakingSessionStarted: boolean
  reminderEnabled: boolean
  /** Checklist đã ăn mừng xong và biến mất vĩnh viễn. */
  checklistDismissed: boolean
  /** Epoch ms lần user từ chối SHEET nhắc học (chưa đụng hộp thoại hệ thống). */
  reminderDeclinedAt: number | null
  hydrate: () => Promise<void>
  markSpokeFirstSentence: () => void
  bumpSrsReviews: () => void
  markSpeakingSession: () => void
  markReminderEnabled: () => void
  declineReminderSheet: (now: number) => void
  dismissChecklist: () => void
}

function persist(key: string, value: string): void {
  SecureStore.setItemAsync(key, value).catch(() => undefined)
}

export const useStarterStore = create<StarterState>((set, get) => ({
  hydrated: false,
  spokeFirstSentence: false,
  srsReviews: 0,
  speakingSessionStarted: false,
  reminderEnabled: false,
  checklistDismissed: false,
  reminderDeclinedAt: null,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const [spoke, srs, speaking, reminder, dismissed, declinedAt] = await Promise.all([
        SecureStore.getItemAsync(KEYS.spoke),
        SecureStore.getItemAsync(KEYS.srs),
        SecureStore.getItemAsync(KEYS.speaking),
        SecureStore.getItemAsync(KEYS.reminder),
        SecureStore.getItemAsync(KEYS.dismissed),
        SecureStore.getItemAsync(KEYS.reminderDeclinedAt),
      ])
      const parsedSrs = srs ? parseInt(srs, 10) : 0
      const parsedDeclined = declinedAt ? parseInt(declinedAt, 10) : NaN
      set({
        hydrated: true,
        spokeFirstSentence: spoke === '1',
        srsReviews: Number.isFinite(parsedSrs) ? Math.min(parsedSrs, SRS_CHECKLIST_TARGET) : 0,
        speakingSessionStarted: speaking === '1',
        reminderEnabled: reminder === '1',
        checklistDismissed: dismissed === '1',
        reminderDeclinedAt: Number.isFinite(parsedDeclined) ? parsedDeclined : null,
      })
    } catch {
      set({ hydrated: true })
    }
  },

  markSpokeFirstSentence: () => {
    if (get().spokeFirstSentence) return
    set({ spokeFirstSentence: true })
    persist(KEYS.spoke, '1')
  },

  bumpSrsReviews: () => {
    const cur = get().srsReviews
    if (cur >= SRS_CHECKLIST_TARGET) return
    const next = cur + 1
    set({ srsReviews: next })
    persist(KEYS.srs, String(next))
  },

  markSpeakingSession: () => {
    if (get().speakingSessionStarted) return
    set({ speakingSessionStarted: true })
    persist(KEYS.speaking, '1')
  },

  markReminderEnabled: () => {
    if (get().reminderEnabled) return
    set({ reminderEnabled: true })
    persist(KEYS.reminder, '1')
  },

  declineReminderSheet: (now) => {
    set({ reminderDeclinedAt: now })
    persist(KEYS.reminderDeclinedAt, String(now))
  },

  dismissChecklist: () => {
    if (get().checklistDismissed) return
    set({ checklistDismissed: true })
    persist(KEYS.dismissed, '1')
  },
}))
