/**
 * Đợt 4 (18/09/2026) — mô hình bước wizard web khớp mobile (W-18). Khoá thứ tự bước, điều kiện
 * rời bước, ước lượng hành trình và hợp đồng payload — cùng ca với `mobile/lib/__tests__/onboardingSteps.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ANSWERS,
  WIZARD_STEP_IDS,
  canLeaveStep,
  goalTypeFor,
  guestAnswersFrom,
  journeyEstimate,
  profilePayloadFrom,
  totalStepsFor,
} from './wizardModel'

describe('thứ tự bước', () => {
  it('mục tiêu → trình độ → nhịp → lĩnh vực/kỳ thi — đúng thứ tự mobile UI v2', () => {
    expect(WIZARD_STEP_IDS).toEqual(['motivation', 'level', 'rhythm', 'focus'])
  })

  it('progressbar: người đã đăng nhập 4 bước; khách thêm quick win + cổng tài khoản = 6', () => {
    expect(totalStepsFor(false)).toBe(4)
    expect(totalStepsFor(true)).toBe(6)
  })
})

describe('canLeaveStep', () => {
  it('bước trình độ đòi targetLevel', () => {
    expect(canLeaveStep('level', { targetLevel: '' })).toBe(false)
    expect(canLeaveStep('level', { targetLevel: 'B1' })).toBe(true)
  })
  it.each(['motivation', 'rhythm', 'focus'] as const)('bước %s luôn rời được', (s) => {
    expect(canLeaveStep(s, { targetLevel: '' })).toBe(true)
  })
})

describe('goalTypeFor', () => {
  it('EXAM → CERT, còn lại WORK; giá trị lạ → WORK', () => {
    expect(goalTypeFor('EXAM')).toBe('CERT')
    expect(goalTypeFor('JOB')).toBe('WORK')
    expect(goalTypeFor('HOBBY')).toBe('WORK')
    expect(goalTypeFor('??')).toBe('WORK')
  })
})

describe('journeyEstimate', () => {
  it('A0→B1 có số thật; cặp khác null (không bịa số)', () => {
    expect(journeyEstimate('A0', 'B1')).toEqual({ nodes: 46, weeks: 11 })
    expect(journeyEstimate('A1', 'B2')).toBeNull()
    expect(journeyEstimate(null, 'B1')).toBeNull()
  })
})

describe('profilePayloadFrom', () => {
  it('mặc định: WORK, A0→B1, 5×15, 15 phút/ngày, NORMAL; lĩnh vực/kỳ thi null', () => {
    expect(profilePayloadFrom(DEFAULT_ANSWERS)).toEqual({
      goalType: 'WORK',
      targetLevel: 'B1',
      currentLevel: 'A0',
      motivation: 'JOB',
      industry: null,
      examType: null,
      sessionsPerWeek: 5,
      minutesPerSession: 15,
      dailyGoalMinutes: 15,
      learningSpeed: 'NORMAL',
    })
  })

  it('WORK gửi industry, không gửi examType; CERT ngược lại', () => {
    const work = profilePayloadFrom({ ...DEFAULT_ANSWERS, industry: 'Pflege', examType: 'TELC' })
    expect(work.industry).toBe('Pflege')
    expect(work.examType).toBeNull()
    const cert = profilePayloadFrom({ ...DEFAULT_ANSWERS, motivation: 'EXAM', industry: 'Pflege', examType: 'TELC' })
    expect(cert.goalType).toBe('CERT')
    expect(cert.industry).toBeNull()
    expect(cert.examType).toBe('TELC')
  })

  it('không còn weeklyTarget / learningSpeed suy từ tuần (W-18)', () => {
    const p = profilePayloadFrom({ ...DEFAULT_ANSWERS, dailyGoalMinutes: 20 })
    expect(p).not.toHaveProperty('weeklyTarget')
    expect(p.learningSpeed).toBe('NORMAL')
    expect(p.dailyGoalMinutes).toBe(20)
  })
})

describe('guestAnswersFrom', () => {
  it('cùng trường với payload, goalType tường minh', () => {
    expect(guestAnswersFrom({ ...DEFAULT_ANSWERS, currentLevel: 'A1', industry: 'IT' })).toEqual({
      motivation: 'JOB',
      goalType: 'WORK',
      currentLevel: 'A1',
      targetLevel: 'B1',
      industry: 'IT',
      examType: null,
      dailyGoalMinutes: 15,
      sessionsPerWeek: 5,
      minutesPerSession: 15,
      learningSpeed: 'NORMAL',
    })
  })
})
