import {
  ONBOARDING_STEP_IDS,
  TOTAL_ONBOARDING_STEPS,
  canLeaveStep,
  journeyEstimate,
} from '../onboardingSteps'

describe('onboardingSteps', () => {
  test('thứ tự bước khoá cứng: motivation → levels → rhythm → focus', () => {
    expect(ONBOARDING_STEP_IDS).toEqual(['motivation', 'levels', 'rhythm', 'focus'])
    expect(TOTAL_ONBOARDING_STEPS).toBe(4)
  })

  test.each([
    ['motivation', null, true],
    ['rhythm', null, true],
    ['focus', null, true],
    ['levels', null, false],
    ['levels', 'B1', true],
  ] as const)('canLeaveStep(%s, targetLevel=%s) → %s', (step, targetLevel, expected) => {
    expect(canLeaveStep(step, { targetLevel })).toBe(expected)
  })

  test('journeyEstimate: cặp đo thật A0→B1 có số', () => {
    expect(journeyEstimate('A0', 'B1')).toEqual({ nodes: 46, weeks: 11 })
  })

  test.each([
    ['A0', 'B2'],
    ['A1', 'B1'],
    [null, 'B1'],
    ['A0', null],
  ])('journeyEstimate(%s, %s) → null — cặp chưa đo không được bịa số', (cur, target) => {
    expect(journeyEstimate(cur, target)).toBeNull()
  })
})
