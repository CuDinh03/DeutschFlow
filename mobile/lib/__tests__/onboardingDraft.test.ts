// Draft phễu onboarding của khách: vòng đời + hạn dùng.
//
// Vì sao cần TTL (QA 2026-08-20, F-3): draft không gắn userId và không hết hạn,
// trong khi effect resume ở app/(auth)/onboarding.tsx chạy cho BẤT KỲ user nào
// đã đăng nhập vào màn đó. Khách A điền phễu rồi bỏ ngang ở màn đăng ký; B đăng
// ký sau trên cùng máy → register đá sang onboarding → draft của A được replay
// im lặng thành hồ sơ của B, và B không hề thấy bảng câu hỏi.

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
import {
  saveOnboardingDraft,
  readOnboardingDraft,
  clearOnboardingDraft,
  DRAFT_TTL_MS,
  type OnboardingDraft,
} from '../onboardingDraft'

const backing = (SecureStore as unknown as { __store: Map<string, string> }).__store
const KEY = 'df_onboarding_draft'

const DRAFT: OnboardingDraft = {
  motivation: 'JOB',
  goalType: 'WORK',
  currentLevel: 'A0',
  targetLevel: 'B1',
  industry: 'Pflege',
  examType: null,
  dailyGoal: '15',
}

describe('onboardingDraft', () => {
  beforeEach(() => {
    backing.clear()
    jest.useRealTimers()
  })

  test('lưu rồi đọc lại nguyên vẹn', async () => {
    await saveOnboardingDraft(DRAFT)

    const read = await readOnboardingDraft()

    expect(read).toMatchObject(DRAFT)
  })

  test('không có draft → null', async () => {
    expect(await readOnboardingDraft()).toBeNull()
  })

  test('thiếu targetLevel → null (trường bắt buộc duy nhất của hồ sơ)', async () => {
    backing.set(KEY, JSON.stringify({ ...DRAFT, targetLevel: '' }))

    expect(await readOnboardingDraft()).toBeNull()
  })

  test('JSON hỏng → null, không ném lỗi', async () => {
    backing.set(KEY, '{ khong-phai-json')

    expect(await readOnboardingDraft()).toBeNull()
  })

  // ── TTL (F-3) ──────────────────────────────────────────────────────────────
  test('quá hạn → null VÀ tự xoá khỏi máy', async () => {
    // Arrange — draft được lưu từ lâu hơn TTL.
    const stale = { ...DRAFT, savedAt: Date.now() - DRAFT_TTL_MS - 1 }
    backing.set(KEY, JSON.stringify(stale))

    // Act
    const read = await readOnboardingDraft()

    // Assert — không replay, và không để lại bom hẹn giờ cho lần đăng ký sau.
    expect(read).toBeNull()
    expect(backing.has(KEY)).toBe(false)
  })

  test('còn trong hạn → trả về bình thường', async () => {
    backing.set(KEY, JSON.stringify({ ...DRAFT, savedAt: Date.now() - 60_000 }))

    expect(await readOnboardingDraft()).toMatchObject(DRAFT)
  })

  test('draft cũ không có savedAt (lưu trước bản vá) → coi như hết hạn', async () => {
    // Arrange — đúng hình dạng draft đang nằm trên máy người dùng hôm nay.
    const { ...noTimestamp } = DRAFT
    backing.set(KEY, JSON.stringify(noTimestamp))

    // Act
    const read = await readOnboardingDraft()

    // Assert — an toàn là ưu tiên: thà hỏi lại bảng câu hỏi còn hơn ghi đè hồ sơ.
    expect(read).toBeNull()
    expect(backing.has(KEY)).toBe(false)
  })

  test('savedAt không phải số → coi như hết hạn', async () => {
    backing.set(KEY, JSON.stringify({ ...DRAFT, savedAt: 'hom-qua' }))

    expect(await readOnboardingDraft()).toBeNull()
  })

  test('clear xoá hẳn', async () => {
    await saveOnboardingDraft(DRAFT)

    await clearOnboardingDraft()

    expect(backing.has(KEY)).toBe(false)
  })

  test('save đóng dấu thời gian để read kiểm hạn được', async () => {
    await saveOnboardingDraft(DRAFT)

    const raw = JSON.parse(backing.get(KEY) as string) as { savedAt?: unknown }

    expect(typeof raw.savedAt).toBe('number')
  })
})
