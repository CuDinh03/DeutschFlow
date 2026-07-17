// Checklist "Bắt đầu" tuần đầu — hydration + các tín hiệu đếm/tick (Phase D §7.1).

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k)
    }),
  }
})

import * as SecureStore from 'expo-secure-store'
import { useStarterStore, SRS_CHECKLIST_TARGET } from '../useStarterStore'

const backing = (SecureStore as unknown as { __store: Map<string, string> }).__store

// setItemAsync trong store là fire-and-forget — chờ microtask để nó kịp ghi.
const flush = () => new Promise((r) => setTimeout(r, 0))

function resetStore() {
  backing.clear()
  useStarterStore.setState({
    hydrated: false,
    spokeFirstSentence: false,
    srsReviews: 0,
    speakingSessionStarted: false,
    reminderEnabled: false,
    checklistDismissed: false,
    reminderDeclinedAt: null,
  })
}

describe('useStarterStore', () => {
  beforeEach(resetStore)

  test('hydrate reads persisted signals and caps the SRS count', async () => {
    backing.set('df_starter_spoke', '1')
    backing.set('df_starter_srs_reviews', '99')
    backing.set('df_starter_reminder_declined_at', '1752000000000')

    await useStarterStore.getState().hydrate()

    const s = useStarterStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.spokeFirstSentence).toBe(true)
    expect(s.srsReviews).toBe(SRS_CHECKLIST_TARGET)
    expect(s.reminderDeclinedAt).toBe(1752000000000)
    expect(s.speakingSessionStarted).toBe(false)
  })

  test('bumpSrsReviews counts up and stops at the checklist target', async () => {
    await useStarterStore.getState().hydrate()

    for (let i = 0; i < SRS_CHECKLIST_TARGET + 3; i++) {
      useStarterStore.getState().bumpSrsReviews()
    }
    await flush()

    expect(useStarterStore.getState().srsReviews).toBe(SRS_CHECKLIST_TARGET)
    expect(backing.get('df_starter_srs_reviews')).toBe(String(SRS_CHECKLIST_TARGET))
  })

  test('one-shot marks persist and are idempotent', async () => {
    await useStarterStore.getState().hydrate()

    useStarterStore.getState().markSpokeFirstSentence()
    useStarterStore.getState().markSpokeFirstSentence()
    useStarterStore.getState().markSpeakingSession()
    useStarterStore.getState().markReminderEnabled()
    useStarterStore.getState().dismissChecklist()
    await flush()

    const s = useStarterStore.getState()
    expect(s.spokeFirstSentence).toBe(true)
    expect(s.speakingSessionStarted).toBe(true)
    expect(s.reminderEnabled).toBe(true)
    expect(s.checklistDismissed).toBe(true)
    expect(backing.get('df_starter_spoke')).toBe('1')
    expect(backing.get('df_starter_speaking')).toBe('1')
    expect(backing.get('df_starter_reminder_on')).toBe('1')
    expect(backing.get('df_starter_dismissed')).toBe('1')
  })

  test('declineReminderSheet stores the cooldown timestamp', async () => {
    await useStarterStore.getState().hydrate()

    useStarterStore.getState().declineReminderSheet(1752710400000)
    await flush()

    expect(useStarterStore.getState().reminderDeclinedAt).toBe(1752710400000)
    expect(backing.get('df_starter_reminder_declined_at')).toBe('1752710400000')
  })
})
