import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DRAFT_TTL_MS,
  saveOnboardingDraft,
  readOnboardingDraft,
  clearOnboardingDraft,
  type OnboardingDraft,
} from '@/lib/onboardingDraft'

const KEY = 'df_onboarding_draft'

const DRAFT: OnboardingDraft = {
  motivation: 'JOB',
  goalType: 'WORK',
  currentLevel: 'A1',
  targetLevel: 'B1',
  industry: 'HEALTHCARE',
  examType: 'GOETHE',
  dailyGoalMinutes: 10,
}

/** Ghi thẳng vào localStorage để dựng draft "đời cũ" hoặc draft đã quá hạn. */
function writeRaw(value: unknown): void {
  localStorage.setItem(KEY, JSON.stringify(value))
}

// jsdom trong repo này chỉ dựng localStorage một phần (thiếu cả clear); các test
// khác đều tự cấp một bản in-memory — theo đúng lệ đó cho deterministic.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
  })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('saveOnboardingDraft', () => {
  it('đóng dấu thời gian vào draft khi lưu', () => {
    saveOnboardingDraft(DRAFT)
    const stored = JSON.parse(localStorage.getItem(KEY) as string)
    expect(stored).toMatchObject(DRAFT)
    expect(stored.savedAt).toBe(Date.now())
  })
})

describe('readOnboardingDraft — hạn dùng', () => {
  it('trả draft khi còn trong hạn', () => {
    saveOnboardingDraft(DRAFT)
    vi.advanceTimersByTime(DRAFT_TTL_MS - 1000)
    expect(readOnboardingDraft()).toEqual(DRAFT)
  })

  it('vẫn trả draft ở đúng mốc hạn (biên tính là còn hạn)', () => {
    saveOnboardingDraft(DRAFT)
    vi.advanceTimersByTime(DRAFT_TTL_MS)
    expect(readOnboardingDraft()).toEqual(DRAFT)
  })

  it('trả null và XOÁ draft khi quá hạn', () => {
    saveOnboardingDraft(DRAFT)
    vi.advanceTimersByTime(DRAFT_TTL_MS + 1)
    expect(readOnboardingDraft()).toBeNull()
    // Xoá luôn, nếu không thì lần vào sau nó lại nằm đó chờ ghi đè hồ sơ người khác.
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('coi draft thiếu savedAt (lưu trước bản vá) là hết hạn và xoá đi', () => {
    writeRaw(DRAFT)
    expect(readOnboardingDraft()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('coi savedAt sai kiểu là hết hạn', () => {
    writeRaw({ ...DRAFT, savedAt: '2026-08-28T10:00:00Z' })
    expect(readOnboardingDraft()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('CHẤP NHẬN draft có savedAt ở tương lai — fail-open khi đồng hồ máy lệch', () => {
    // savedAt tương lai ⇒ hiệu số âm ⇒ vẫn "trong hạn". Fail-open là có chủ ý:
    // đồng hồ lệch là chuyện của máy người dùng, và nới hạn thì không làm hỏng
    // dữ liệu, còn xoá nhầm thì mất câu trả lời của người ta.
    writeRaw({ ...DRAFT, savedAt: Date.now() + 24 * 60 * 60 * 1000 })

    expect(readOnboardingDraft()).toEqual(DRAFT)
    // Và draft phải CÒN NGUYÊN — đây là thứ phân biệt fail-open thật sự với
    // nhánh hết hạn (nhánh đó xoá draft đi).
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })
})

describe('readOnboardingDraft — dữ liệu hỏng', () => {
  it('trả null khi không có draft', () => {
    expect(readOnboardingDraft()).toBeNull()
  })

  it('trả null khi JSON hỏng', () => {
    localStorage.setItem(KEY, '{khong-phai-json')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('trả null khi thiếu targetLevel — trường bắt buộc duy nhất của hồ sơ', () => {
    writeRaw({ ...DRAFT, targetLevel: '', savedAt: Date.now() })
    expect(readOnboardingDraft()).toBeNull()
  })

  it('điền mặc định cho các trường khuyết nhưng còn hạn', () => {
    writeRaw({ targetLevel: 'B2', savedAt: Date.now() })
    expect(readOnboardingDraft()).toEqual({
      motivation: 'JOB',
      goalType: 'WORK',
      currentLevel: 'A0',
      targetLevel: 'B2',
      industry: null,
      examType: null,
      dailyGoalMinutes: 15,
    })
  })

  it('Đợt 4: draft bản cũ còn `weeklyTarget` được đổi sang phút/ngày (7→20, 5→15, 3→10)', () => {
    writeRaw({ targetLevel: 'B1', weeklyTarget: 7, savedAt: Date.now() })
    expect(readOnboardingDraft()?.dailyGoalMinutes).toBe(20)
    writeRaw({ targetLevel: 'B1', weeklyTarget: 3, savedAt: Date.now() })
    expect(readOnboardingDraft()?.dailyGoalMinutes).toBe(10)
    // Có cả hai thì phút/ngày thắng.
    writeRaw({ targetLevel: 'B1', weeklyTarget: 7, dailyGoalMinutes: 5, savedAt: Date.now() })
    expect(readOnboardingDraft()?.dailyGoalMinutes).toBe(5)
  })
})

describe('readOnboardingDraft — pathChoice (Đợt 4 PR-2, I-9)', () => {
  it('lưu rồi đọc lại; draft cũ không có trường → vắng mặt (chưa chọn)', () => {
    saveOnboardingDraft({ ...DRAFT, pathChoice: 'mock_exam' })
    expect(readOnboardingDraft()?.pathChoice).toBe('mock_exam')

    localStorage.setItem('df_onboarding_draft', JSON.stringify({ ...DRAFT, savedAt: Date.now() }))
    expect(readOnboardingDraft()?.pathChoice).toBeUndefined()
  })

  it('giá trị lạ → vắng mặt, không ném', () => {
    localStorage.setItem('df_onboarding_draft', JSON.stringify({ ...DRAFT, savedAt: Date.now(), pathChoice: 'rac' }))
    expect(readOnboardingDraft()?.pathChoice).toBeUndefined()
  })
})

describe('clearOnboardingDraft', () => {
  it('xoá hẳn draft khỏi máy', () => {
    saveOnboardingDraft(DRAFT)
    clearOnboardingDraft()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(readOnboardingDraft()).toBeNull()
  })
})
