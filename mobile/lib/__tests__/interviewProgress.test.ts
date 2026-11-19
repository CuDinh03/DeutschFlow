import { INTERVIEW_PHASES, chatStatus, formatElapsed, interviewPhaseIndex } from '@/lib/speakingChat'

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

describe('dòng trạng thái phòng hội thoại', () => {
  const base = { recording: false, transcribing: false, sending: false, aiSpeaking: false, finishing: false, name: 'Anna' }
  test('ưu tiên đang tạo báo cáo, đang ghi, nhận diện, AI trả lời', () => {
    expect(chatStatus({ ...base, finishing: true, recording: true })).toBe('Đang tạo báo cáo…')
    expect(chatStatus({ ...base, recording: true })).toMatch(/Đang nghe bạn nói/)
    expect(chatStatus({ ...base, transcribing: true })).toMatch(/nhận diện/)
    expect(chatStatus({ ...base, sending: true })).toBe('Anna đang trả lời…')
    expect(chatStatus({ ...base, aiSpeaking: true })).toBe('Anna đang nói')
    expect(chatStatus(base)).toBe('Đến lượt bạn · trả lời Anna')
    expect(chatStatus({ ...base, name: null })).toBe('Đến lượt bạn · trả lời AI')
  })
})
