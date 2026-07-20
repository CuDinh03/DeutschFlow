// Per-flag tour store: hydration, legacy-key migration and persistence.

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
import { useTourStore, TOUR_FLAG_IDS } from '../useTourStore'

const backing = (SecureStore as unknown as { __store: Map<string, string> }).__store

function resetStore() {
  backing.clear()
  useTourStore.setState({
    hydrated: false,
    done: { home: false, srs_intro: false, speaking_intro: false, first_sentence: false },
  })
}

describe('useTourStore', () => {
  beforeEach(resetStore)

  test('hydrate reads persisted per-flag keys', async () => {
    // Arrange
    backing.set('df_tour_home_done', '1')
    backing.set('df_tour_speaking_intro_done', '1')

    // Act
    await useTourStore.getState().hydrate()

    // Assert
    const s = useTourStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.done.home).toBe(true)
    expect(s.done.speaking_intro).toBe(true)
    expect(s.done.srs_intro).toBe(false)
    expect(s.done.first_sentence).toBe(false)
  })

  test('legacy df_guide_tour_done migrates to the home flag', async () => {
    backing.set('df_guide_tour_done', '1')

    await useTourStore.getState().hydrate()

    expect(useTourStore.getState().done.home).toBe(true)
    expect(useTourStore.getState().done.srs_intro).toBe(false)
  })

  test('markDone updates state and persists the flag key', async () => {
    await useTourStore.getState().hydrate()

    await useTourStore.getState().markDone('srs_intro')

    expect(useTourStore.getState().done.srs_intro).toBe(true)
    expect(backing.get('df_tour_srs_intro_done')).toBe('1')
  })

  test('hydrate is a no-op once hydrated (does not clobber later markDone)', async () => {
    await useTourStore.getState().hydrate()
    await useTourStore.getState().markDone('home')

    await useTourStore.getState().hydrate()

    expect(useTourStore.getState().done.home).toBe(true)
  })

  test('every flag id round-trips through markDone', async () => {
    await useTourStore.getState().hydrate()
    for (const id of TOUR_FLAG_IDS) {
      await useTourStore.getState().markDone(id)
      expect(useTourStore.getState().done[id]).toBe(true)
      expect(backing.get(`df_tour_${id}_done`)).toBe('1')
    }
  })
})
