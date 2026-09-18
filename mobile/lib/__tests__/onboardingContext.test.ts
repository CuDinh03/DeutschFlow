/**
 * Đợt 5 (17/09/2026) — `GET /onboarding/context` phía mobile + bộ mặc định của bản rút gọn.
 * Web chạy cùng bộ ca trên `frontend/src/features/onboarding/context.ts`.
 */
const getMock = jest.fn()
jest.mock('@/lib/api', () => ({ __esModule: true, default: { get: (...a: unknown[]) => getMock(...a) } }))

import {
  defaultTargetLevelFor,
  fetchOnboardingContext,
  isOrgAccount,
  liteProfilePayload,
  needsLiteProfile,
  normalizePresetLevel,
  type OnboardingContext,
} from '@/lib/onboardingContext'

const orgCtx: OnboardingContext = {
  accountSource: 'ORG_ROSTER',
  hasPlan: false,
  org: { orgId: 7, name: 'Trung tâm Sao Việt', classId: 42, className: 'B1 tối thứ 3' },
  presetCurrentLevel: 'A2',
  trial: { isTrial: true, trialEndsAt: '2026-10-31T00:00:00Z' },
}

describe('fetchOnboardingContext', () => {
  beforeEach(() => getMock.mockReset())

  it('GET /onboarding/context và trả nguyên payload', async () => {
    getMock.mockResolvedValue({ data: orgCtx })
    await expect(fetchOnboardingContext()).resolves.toEqual(orgCtx)
    expect(getMock).toHaveBeenCalledWith('/onboarding/context')
  })

  it.each([
    ['404 backend cũ', { response: { status: 404 } }],
    ['mất mạng', new Error('Network Error')],
  ])('%s → null, KHÔNG ném (caller coi như SELF)', async (_n, err) => {
    getMock.mockRejectedValue(err)
    await expect(fetchOnboardingContext()).resolves.toBeNull()
  })
})

describe('isOrgAccount / needsLiteProfile', () => {
  it.each([
    ['ORG_ROSTER', true],
    ['ORG_INVITE', true],
    ['SELF', false],
    [undefined, false],
    [null, false],
  ])('%s → %s', (src, expected) => {
    expect(isOrgAccount(src as never)).toBe(expected)
  })

  it('học viên trung tâm chưa có plan → bản rút gọn', () => {
    expect(needsLiteProfile(orgCtx)).toBe(true)
  })

  it('đã có plan (W3/W5) hoặc SELF hoặc không có context → phễu thường', () => {
    expect(needsLiteProfile({ ...orgCtx, hasPlan: true })).toBe(false)
    expect(needsLiteProfile({ ...orgCtx, accountSource: 'SELF' })).toBe(false)
    expect(needsLiteProfile(null)).toBe(false)
  })
})

describe('normalizePresetLevel', () => {
  it.each([
    ['A2', 'A2'],
    ['b1', 'B1'],
    [' C1 ', 'C1'],
    ['A0', 'A0'],
    ['X9', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePresetLevel(raw)).toBe(expected)
  })
})

describe('defaultTargetLevelFor', () => {
  it.each([
    [null, 'B1'],
    ['A0', 'B1'],
    ['A1', 'B1'],
    ['A2', 'B1'],
    ['B1', 'B2'],
    ['B2', 'C1'],
    ['C1', 'C2'],
    ['C2', 'C2'],
    ['lạ', 'B1'],
  ])('%s → %s', (level, expected) => {
    expect(defaultTargetLevelFor(level)).toBe(expected)
  })
})

describe('liteProfilePayload', () => {
  it('đủ trường bắt buộc của POST /onboarding/profile (Đợt 3: bỏ ageRange/interests/workUseCases thừa); mục tiêu/lĩnh vực/kỳ thi để trống cố ý', () => {
    expect(liteProfilePayload({ currentLevel: 'A2', sessionsPerWeek: 5, dailyGoalMinutes: 15 })).toEqual({
      goalType: 'WORK',
      targetLevel: 'B1',
      currentLevel: 'A2',
      motivation: null,
      industry: null,
      examType: null,
      sessionsPerWeek: 5,
      minutesPerSession: 15,
      dailyGoalMinutes: 15,
      learningSpeed: 'NORMAL',
    })
  })

  it('trình độ null/lạ → A0 (theo ma trận LevelBand.of(null) = ZERO); nhịp 7 → FAST, 3 → SLOW', () => {
    const p7 = liteProfilePayload({ currentLevel: null, sessionsPerWeek: 7, dailyGoalMinutes: 20 })
    expect(p7.currentLevel).toBe('A0')
    expect(p7.targetLevel).toBe('B1')
    expect(p7.learningSpeed).toBe('FAST')
    expect(liteProfilePayload({ currentLevel: 'zz', sessionsPerWeek: 3, dailyGoalMinutes: 10 }).learningSpeed).toBe('SLOW')
  })

  it('B1 sẵn có → nhắm B2, không nhắm lại chính mức đang có', () => {
    expect(liteProfilePayload({ currentLevel: 'B1', sessionsPerWeek: 5, dailyGoalMinutes: 15 }).targetLevel).toBe('B2')
  })
})
