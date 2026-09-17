/**
 * Guest session client mobile (Đợt 2). Cùng ba bất biến với bản web: cache hết hạn = không có;
 * PATCH không chặn UI; claim 400 (I-7) vứt CẢ draft.
 */
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
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
const postMock = jest.fn()
const patchMock = jest.fn()
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: (...a: unknown[]) => postMock(...a), patch: (...a: unknown[]) => patchMock(...a) } }))
const clearDraftMock = jest.fn(async () => undefined)
jest.mock('@/lib/onboardingDraft', () => ({ clearOnboardingDraft: () => clearDraftMock() }))

import * as SecureStore from 'expo-secure-store'
import {
  GUEST_SESSION_KEY,
  claimGuestSession,
  ensureGuestSession,
  guestPlatform,
  readGuestSessionCache,
  syncGuestSession,
} from '@/lib/guestSession'

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store
const FUTURE = new Date(Date.now() + 72 * 3600_000).toISOString()
const PAST = new Date(Date.now() - 1000).toISOString()
const SID = '11111111-2222-3333-4444-555555555555'

function seed(overrides: Partial<{ expiresAt: string; answers: Record<string, unknown> }> = {}) {
  store.set(GUEST_SESSION_KEY, JSON.stringify({ sessionId: SID, expiresAt: FUTURE, currentStep: 'PROFILE', answers: {}, savedAt: Date.now(), ...overrides }))
}

beforeEach(() => {
  store.clear()
  postMock.mockReset()
  patchMock.mockReset()
  clearDraftMock.mockClear()
})

describe('guestSession mobile', () => {
  it('platform iOS → IOS', () => {
    expect(guestPlatform()).toBe('IOS')
  })

  it('cache hết hạn → null và xoá', async () => {
    seed({ expiresAt: PAST })
    expect(await readGuestSessionCache()).toBeNull()
    expect(store.has(GUEST_SESSION_KEY)).toBe(false)
  })

  it('ensure: chưa có → POST platform IOS, ghi cache; đã có → không gọi', async () => {
    postMock.mockResolvedValue({ data: { sessionId: 's-1', currentStep: 'INTRO', flowVersion: 'onb_v3', expiresAt: FUTURE } })
    expect(await ensureGuestSession('vi')).toBe('s-1')
    expect(postMock).toHaveBeenCalledWith('/onboarding/guest-session', { platform: 'IOS', locale: 'vi' })
    postMock.mockClear()
    expect(await ensureGuestSession('vi')).toBe('s-1')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('ensure: server lỗi → null, không ném', async () => {
    postMock.mockRejectedValue({ response: { status: 429 } })
    expect(await ensureGuestSession('vi')).toBeNull()
  })

  it('sync: gộp answers + ghi cache; 404 vứt cache; 500 giữ', async () => {
    seed({ answers: { motivation: 'JOB' } })
    patchMock.mockResolvedValue({ data: {} })
    expect(await syncGuestSession('TASTE', { targetLevel: 'B1' })).toBe(true)
    expect(patchMock).toHaveBeenCalledWith(`/onboarding/guest-session/${SID}`, { currentStep: 'TASTE', answers: { motivation: 'JOB', targetLevel: 'B1' } })
    expect((await readGuestSessionCache())?.answers).toEqual({ motivation: 'JOB', targetLevel: 'B1' })
    patchMock.mockRejectedValueOnce({ response: { status: 404 } })
    expect(await syncGuestSession('TASTE')).toBe(false)
    expect(await readGuestSessionCache()).toBeNull()
    seed()
    patchMock.mockRejectedValueOnce({ response: { status: 500 } })
    expect(await syncGuestSession('TASTE')).toBe(false)
    expect(await readGuestSessionCache()).not.toBeNull()
  })

  it('claim: claimed → dọn cache + draft, trả answers', async () => {
    seed({ answers: { currentLevel: 'A0', targetLevel: 'B1', dailyGoalMinutes: 15 } })
    postMock.mockResolvedValue({ data: { claimed: true, alreadyClaimed: false, progress: { flowVersion: 'onb_v3', lastStep: 'CLAIMED', completedActivities: [], activatedAt: null, coreCompletedAt: null } } })
    const r = await claimGuestSession()
    expect(r.status).toBe('claimed')
    if (r.status === 'claimed') expect(r.answers.dailyGoalMinutes).toBe(15)
    expect(postMock).toHaveBeenCalledWith('/onboarding/claim', { sessionId: SID })
    expect(await readGuestSessionCache()).toBeNull()
    expect(clearDraftMock).toHaveBeenCalled()
  })

  it.each([
    ['400 phiên của người khác → foreign, vứt cả draft', { response: { status: 400 } }, 'foreign', true, false],
    ['404 hết hạn → expired, giữ draft', { response: { status: 404 } }, 'expired', false, false],
    ['mất mạng → error, giữ cả cache lẫn draft', new Error('Network Error'), 'error', false, true],
  ])('claim: %s', async (_n, err, status, draftCleared, cacheKept) => {
    seed()
    postMock.mockRejectedValue(err)
    expect((await claimGuestSession()).status).toBe(status)
    expect(clearDraftMock.mock.calls.length > 0).toBe(draftCleared)
    expect((await readGuestSessionCache()) !== null).toBe(cacheKept)
  })

  it('không có cache → none', async () => {
    expect(await claimGuestSession()).toEqual({ status: 'none' })
  })
})
