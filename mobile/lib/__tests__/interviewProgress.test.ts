import { INTERVIEW_PHASES, formatElapsed, interviewPhaseIndex } from '@/lib/speakingChat'

describe('tiến độ phòng phỏng vấn', () => {
  test('năm pha đúng thứ tự backend', () => {
    expect(INTERVIEW_PHASES).toEqual(['INTRO', 'ICE_BREAKER', 'HARD_SKILLS', 'STAR_SOFT', 'CLOSING'])
    expect(interviewPhaseIndex('HARD_SKILLS')).toBe(2)
    expect(interviewPhaseIndex('LẠ')).toBe(-1)
    expect(interviewPhaseIndex(null)).toBe(-1)
  })

  test('đồng hồ mm:ss, không âm', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(521_400)).toBe('08:41')
    expect(formatElapsed(-5_000)).toBe('00:00')
  })
})
