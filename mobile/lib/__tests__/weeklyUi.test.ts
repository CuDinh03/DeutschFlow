import { conversationHeadline, dayMonth, isoWeek, weeklyScoreLabel, wpmRatio } from '../weeklyUi'
import { recentConversation } from '../interviewHub'
import type { AiSpeakingSession } from '../speakingApi'

describe('weeklyUi', () => {
  it('isoWeek theo ISO-8601', () => {
    expect(isoWeek('2026-11-16')).toBe(47)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53) // thứ Sáu thuộc tuần cuối của 2026
    expect(isoWeek('rác')).toBeNull()
  })
  it('dayMonth không lệch múi giờ', () => {
    expect(dayMonth('2026-11-15')).toBe('15/11')
    // Chỉ đọc phần ngày của chuỗi (đề tuần trả 'YYYY-MM-DD'); không dùng cho thời điểm có múi giờ.
    expect(dayMonth('2026-11-15T10:00:00')).toBe('15/11')
    expect(dayMonth('x')).toBe('x')
    expect(dayMonth(null)).toBe('')
  })
  it('weeklyScoreLabel', () => {
    expect(weeklyScoreLabel(5)?.label).toBe('Rất tốt')
    expect(weeklyScoreLabel(4)?.tone).toBe('success')
    expect(weeklyScoreLabel(3)?.label).toBe('Khá')
    expect(weeklyScoreLabel(1)?.tone).toBe('danger')
    expect(weeklyScoreLabel(null)).toBeNull()
  })
  it('wpmRatio kẹp 0…1', () => {
    expect(wpmRatio(75)).toBe(0.5)
    expect(wpmRatio(400)).toBe(1)
    expect(wpmRatio(null)).toBe(0)
  })
})

describe('recentConversation', () => {
  const base = { cefrLevel: 'A2', persona: 'ANNA', responseSchema: null, status: 'ENDED', lastActivityAt: null, messageCount: 4, initialAiMessage: null, interviewPosition: null, experienceLevel: null, interviewReportJson: null }
  it('lấy buổi hội thoại đã kết thúc mới nhất, bỏ phỏng vấn và buổi dở', () => {
    const list = [
      { ...base, id: 3, topic: 'Beruf', sessionMode: 'INTERVIEW', startedAt: '2026-11-19T08:00:00', endedAt: '2026-11-19T08:10:00' },
      { ...base, id: 2, topic: 'Alltag', sessionMode: 'COMMUNICATION', startedAt: '2026-11-19T07:00:00', endedAt: null },
      { ...base, id: 1, topic: 'Beim Arzt', sessionMode: 'COMMUNICATION', startedAt: '2026-11-18T07:00:00', endedAt: '2026-11-18T07:15:00' },
    ] as AiSpeakingSession[]
    expect(recentConversation(list, new Date('2026-11-19T12:00:00'))).toEqual({ id: 1, title: 'Beim Arzt', when: 'Hôm qua' })
    expect(recentConversation([], new Date())).toBeNull()
  })
})

describe('conversationHeadline', () => {
  it('theo điểm /10', () => {
    expect(conversationHeadline(8.5).mark).toBe('Rất tốt')
    expect(conversationHeadline(6).mark).toBe('Đạt')
    expect(conversationHeadline(4.2).mark).toBe('Gần đạt')
    expect(conversationHeadline(2).mark).toBe('Cần luyện')
    expect(conversationHeadline(null).mark).toBe('Xong')
  })
})
