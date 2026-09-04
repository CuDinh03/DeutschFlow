import { describe, expect, it } from 'vitest'
import {
  isSkillMastered,
  nextSkillToPractice,
  parsePracticeOverview,
} from './practiceStats'

describe('parsePracticeOverview', () => {
  it('đọc row SQL snake_case thành thống kê theo kỹ năng', () => {
    const stats = parsePracticeOverview({
      nodeTitle: 'Tag 13',
      sessions: [
        { skill_type: 'HOEREN', status: 'COMPLETED', score_percent: 85, best_score_percent: 85 },
        { skill_type: 'LESEN', status: 'ACTIVE', score_percent: null, best_score_percent: 40 },
      ],
    })

    expect(stats.hoeren).toEqual({ bestScorePercent: 85, latestStatus: 'COMPLETED' })
    expect(stats.lesen).toEqual({ bestScorePercent: 40, latestStatus: 'ACTIVE' })
    expect(stats.sprechen).toBeUndefined()
  })

  it('chịu được payload rỗng, thiếu sessions, hoặc row rác', () => {
    expect(parsePracticeOverview({})).toEqual({})
    expect(parsePracticeOverview(null)).toEqual({})
    expect(parsePracticeOverview({ sessions: 'kaputt' })).toEqual({})
    expect(
      parsePracticeOverview({ sessions: [null, 42, { skill_type: 'TANZEN' }] }),
    ).toEqual({})
  })

  it('best_score_percent thiếu hoặc không phải số thì thành null, không thành NaN', () => {
    const stats = parsePracticeOverview({
      sessions: [{ skill_type: 'SPRECHEN', status: 'ACTIVE' }],
    })
    expect(stats.sprechen).toEqual({ bestScorePercent: null, latestStatus: 'ACTIVE' })
  })
})

describe('isSkillMastered', () => {
  it('đạt từ 70% trở lên, chưa có session thì chưa đạt', () => {
    expect(isSkillMastered({ bestScorePercent: 70, latestStatus: 'COMPLETED' })).toBe(true)
    expect(isSkillMastered({ bestScorePercent: 69, latestStatus: 'COMPLETED' })).toBe(false)
    expect(isSkillMastered({ bestScorePercent: null, latestStatus: 'ACTIVE' })).toBe(false)
    expect(isSkillMastered(undefined)).toBe(false)
  })
})

describe('nextSkillToPractice', () => {
  it('chọn kỹ năng đầu tiên chưa đạt theo thứ tự Nghe → Đọc → Nói → Viết', () => {
    expect(nextSkillToPractice({})).toBe('hoeren')
    expect(
      nextSkillToPractice({ hoeren: { bestScorePercent: 85, latestStatus: 'COMPLETED' } }),
    ).toBe('lesen')
    expect(
      nextSkillToPractice({
        hoeren: { bestScorePercent: 85, latestStatus: 'COMPLETED' },
        lesen: { bestScorePercent: 40, latestStatus: 'ACTIVE' },
      }),
    ).toBe('lesen')
  })

  it('đạt cả bốn thì quay về kỹ năng đầu', () => {
    const done = { bestScorePercent: 90, latestStatus: 'COMPLETED' }
    expect(
      nextSkillToPractice({ hoeren: done, lesen: done, sprechen: done, schreiben: done }),
    ).toBe('hoeren')
  })
})
