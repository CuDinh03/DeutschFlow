// Khoá điểm rẽ sau khi hồ sơ đã lên server (Đợt 4 PR-2). Cùng bất biến với bản mobile
// (`mobile/lib/__tests__/onboardingRouting.test.ts`): A0 luôn bài đầu (I-1), học viên trung tâm
// không bị hỏi đường (I-11), không đọc ma trận route API (W-1).
import { describe, expect, it } from 'vitest'
import {
  BEGINNER_ROUTE,
  MOCK_EXAM_ROUTE,
  ROADMAP_ROUTE,
  guestNeedsPathChoice,
  nextAfterProfile,
} from './postProfileRoute'

describe('nextAfterProfile — A0 (I-1, W8a)', () => {
  it.each([null, undefined, '', 'A0'])('trình độ %p → Ngày 1, bất kể pathChoice', (level) => {
    expect(nextAfterProfile({ level, pathChoice: null })).toEqual({ kind: 'beginner', href: BEGINNER_ROUTE })
    expect(nextAfterProfile({ level, pathChoice: 'skip' })).toEqual({ kind: 'beginner', href: BEGINNER_ROUTE })
    expect(nextAfterProfile({ level, pathChoice: 'placement' })).toEqual({ kind: 'beginner', href: BEGINNER_ROUTE })
  })

  it('học viên trung tâm A0 cũng vào Ngày 1', () => {
    expect(nextAfterProfile({ level: 'A0', accountSource: 'ORG_ROSTER' }).kind).toBe('beginner')
  })
})

describe('nextAfterProfile — học viên trung tâm A1+ (I-11)', () => {
  it.each(['ORG_ROSTER', 'ORG_INVITE'] as const)('%s → lộ trình, không hỏi đường, không placement', (accountSource) => {
    expect(nextAfterProfile({ level: 'A2', accountSource, pathChoice: null })).toEqual({ kind: 'roadmap', href: ROADMAP_ROUTE })
    expect(nextAfterProfile({ level: 'B1', accountSource, pathChoice: 'placement' })).toEqual({ kind: 'roadmap', href: ROADMAP_ROUTE })
    expect(nextAfterProfile({ level: 'B1', accountSource, pathChoice: 'mock_exam' })).toEqual({ kind: 'roadmap', href: ROADMAP_ROUTE })
  })
})

describe('nextAfterProfile — A1+ tự đăng ký', () => {
  it('chưa chọn đường (đăng ký thẳng, fixture R5) → Chọn đường', () => {
    expect(nextAfterProfile({ level: 'A1' })).toEqual({ kind: 'path_choice' })
    expect(nextAfterProfile({ level: 'B2', accountSource: null, pathChoice: null })).toEqual({ kind: 'path_choice' })
  })

  it('placement (fixture C1 → claim) → bài kiểm tra trong trang', () => {
    expect(nextAfterProfile({ level: 'A2', pathChoice: 'placement' })).toEqual({ kind: 'placement' })
  })

  it('mock_exam → nói thử 3′ với mentor (W5b nối trang mồ côi)', () => {
    expect(nextAfterProfile({ level: 'B1', pathChoice: 'mock_exam' })).toEqual({ kind: 'mock_exam', href: MOCK_EXAM_ROUTE })
  })

  it('skip (fixture C5) → HOME_WEEK1 = lộ trình cho tới khi có checklist W10', () => {
    expect(nextAfterProfile({ level: 'A1', pathChoice: 'skip' })).toEqual({ kind: 'roadmap', href: ROADMAP_ROUTE })
  })
})

describe('guestNeedsPathChoice', () => {
  it('A0/chưa chọn → không; A1+ → có', () => {
    expect(guestNeedsPathChoice('A0')).toBe(false)
    expect(guestNeedsPathChoice(null)).toBe(false)
    expect(guestNeedsPathChoice('A1')).toBe(true)
    expect(guestNeedsPathChoice('B2')).toBe(true)
  })
})
