import { describe, expect, it } from 'vitest'
import { CELEBRATE_ROUTE, afterCelebrateState, celebrateHref, isFirstCompletion, parseCelebrateParams } from './celebrate'
import type { OnboardingProgress } from './starterChecklist'

function params(q: string) {
  const sp = new URLSearchParams(q)
  return (name: string) => sp.get(name)
}

describe('W9 — ăn mừng', () => {
  it('href mang kind; placement mang thêm passed 1/0', () => {
    expect(celebrateHref('beginner')).toBe(`${CELEBRATE_ROUTE}?kind=beginner`)
    expect(celebrateHref('mock_exam')).toBe(`${CELEBRATE_ROUTE}?kind=mock_exam`)
    expect(celebrateHref('placement', { passed: true })).toBe(`${CELEBRATE_ROUTE}?kind=placement&passed=1`)
    expect(celebrateHref('placement', { passed: false })).toBe(`${CELEBRATE_ROUTE}?kind=placement&passed=0`)
  })

  it('parse: kind hợp lệ giữ nguyên, lạ/thiếu rơi về beginner (không 404 khoảnh khắc tốt)', () => {
    expect(parseCelebrateParams(params('kind=placement&passed=0'))).toEqual({ kind: 'placement', passed: false })
    expect(parseCelebrateParams(params('kind=mock_exam'))).toEqual({ kind: 'mock_exam', passed: null })
    expect(parseCelebrateParams(params('kind=xyz'))).toEqual({ kind: 'beginner', passed: null })
    expect(parseCelebrateParams(params(''))).toEqual({ kind: 'beginner', passed: null })
  })

  it('passed chỉ có nghĩa với placement', () => {
    expect(parseCelebrateParams(params('kind=beginner&passed=1')).passed).toBeNull()
    expect(parseCelebrateParams(params('kind=placement&passed=maybe')).passed).toBeNull()
  })

  it('celebrate_done → HOME_WEEK1 theo fixture E1', () => {
    expect(afterCelebrateState()).toBe('HOME_WEEK1')
  })

  it('isFirstCompletion: chưa có FIRST_LESSON:<kind> ⇒ lần đầu; đã có ⇒ không; payload lệch ⇒ không (an toàn)', () => {
    const p = (a: string[]): OnboardingProgress => ({ flowVersion: 'onb_v3', lastStep: 'CLAIMED', completedActivities: a, activatedAt: null, coreCompletedAt: null })
    expect(isFirstCompletion(p([]), 'MOCK_EXAM')).toBe(true)
    expect(isFirstCompletion(p(['FIRST_LESSON:BEGINNER_SESSION']), 'MOCK_EXAM')).toBe(true)
    expect(isFirstCompletion(p(['FIRST_LESSON:MOCK_EXAM']), 'MOCK_EXAM')).toBe(false)
    expect(isFirstCompletion(p(['FIRST_LESSON:PLACEMENT']), 'PLACEMENT')).toBe(false)
    expect(isFirstCompletion(null, 'PLACEMENT')).toBe(false)
    expect(isFirstCompletion({} as OnboardingProgress, 'PLACEMENT')).toBe(false)
  })
})
