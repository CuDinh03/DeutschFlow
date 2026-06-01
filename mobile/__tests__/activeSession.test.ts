jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {}
  return {
    setItemAsync: jest.fn((k: string, v: string) => {
      store[k] = v
      return Promise.resolve()
    }),
    getItemAsync: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    deleteItemAsync: jest.fn((k: string) => {
      delete store[k]
      return Promise.resolve()
    }),
  }
})

import * as SecureStore from 'expo-secure-store'
import { saveActiveSession, loadActiveSession, clearActiveSession } from '@/lib/activeSession'

describe('activeSession persistence', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns null when nothing is stored', async () => {
    await clearActiveSession()
    expect(await loadActiveSession()).toBeNull()
  })

  it('round-trips a saved session ref', async () => {
    await saveActiveSession({ id: 42, interviewPosition: 'Backend Developer' })
    expect(await loadActiveSession()).toEqual({ id: 42, interviewPosition: 'Backend Developer' })
  })

  it('clears the stored ref', async () => {
    await saveActiveSession({ id: 1, interviewPosition: null })
    await clearActiveSession()
    expect(await loadActiveSession()).toBeNull()
  })

  it('returns null for malformed stored data (no numeric id)', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{"foo":1}')
    expect(await loadActiveSession()).toBeNull()
  })

  it('returns null when the stored value is not valid JSON', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('not-json{')
    expect(await loadActiveSession()).toBeNull()
  })
})
