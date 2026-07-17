// Step content for the spotlight tours — the order is an OWNER DECISION
// (plan 2026-07-17 §5.2, Q2): streak → tab Học → chặng đang mở → tab Speaking
// → kết tương tác. These tests pin that order so refactors can't silently
// reshuffle it.

import { buildTourSteps, SPOTLIGHT_TARGETS } from '../spotlightTours'

describe('buildTourSteps(home)', () => {
  test('has the 5 locked steps in the locked order', () => {
    const steps = buildTourSteps('home')

    expect(steps.map((s) => s.targetId)).toEqual([
      SPOTLIGHT_TARGETS.homeStreak,
      SPOTLIGHT_TARGETS.tabLearn,
      SPOTLIGHT_TARGETS.learnActiveNode,
      SPOTLIGHT_TARGETS.tabSpeaking,
      SPOTLIGHT_TARGETS.learnActiveNode,
    ])
  })

  test('step 1 opens on Home; steps 3 and 5 require the learn screen', () => {
    const steps = buildTourSteps('home')

    expect(steps[0].route).toBe('/(student)')
    expect(steps[1].route).toBeUndefined()
    expect(steps[2].route).toBe('/(student)/learn')
    expect(steps[3].route).toBeUndefined()
    expect(steps[4].route).toBe('/(student)/learn')
  })

  test('only the final step is tap-through (ends with a real action)', () => {
    const steps = buildTourSteps('home')

    expect(steps.slice(0, 4).every((s) => !s.tapThrough)).toBe(true)
    expect(steps[4].tapThrough).toBe(true)
  })

  test('streak copy echoes the daily goal when known, generic otherwise', () => {
    expect(buildTourSteps('home', { dailyGoalMinutes: 15 })[0].desc).toContain('15 phút/ngày')
    expect(buildTourSteps('home')[0].desc).not.toContain('phút/ngày')
  })

  test('every step keeps the ≤2-sentence tooltip budget', () => {
    for (const step of buildTourSteps('home', { dailyGoalMinutes: 15 })) {
      const sentences = step.desc.split(/[.!?]/).filter((s) => s.trim().length > 0)
      expect(sentences.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('coach marks', () => {
  test('srs_intro is a single step anchored to the SRS card with the due count', () => {
    const steps = buildTourSteps('srs_intro', { dueCount: 7 })

    expect(steps).toHaveLength(1)
    expect(steps[0].targetId).toBe(SPOTLIGHT_TARGETS.homeSrsCard)
    expect(steps[0].desc).toContain('7 từ')
  })

  test('srs_intro copy stays valid without a count', () => {
    expect(buildTourSteps('srs_intro')[0].desc).not.toMatch(/^0 /)
  })

  test('speaking_intro is a single step anchored to the mode tabs', () => {
    const steps = buildTourSteps('speaking_intro')

    expect(steps).toHaveLength(1)
    expect(steps[0].targetId).toBe(SPOTLIGHT_TARGETS.speakingModeTabs)
  })
})
