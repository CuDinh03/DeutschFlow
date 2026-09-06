import { describe, expect, it } from 'vitest'
import { pickExamFeedback } from './examFeedbackLocale'

const both = { feedback_vi: 'Bạn đã trả lời đủ 3 ý.', feedback_de: 'Sie haben alle 3 Punkte beantwortet.' }

describe('pickExamFeedback', () => {
  it('trả bản tiếng Đức khi giao diện là tiếng Đức', () => {
    expect(pickExamFeedback(both, 'de')).toBe(both.feedback_de)
  })

  it('trả bản tiếng Việt khi giao diện là tiếng Việt', () => {
    expect(pickExamFeedback(both, 'vi')).toBe(both.feedback_vi)
  })

  it('giữ hành vi cũ cho giao diện tiếng Anh vì backend không sinh bản tiếng Anh', () => {
    expect(pickExamFeedback(both, 'en')).toBe(both.feedback_vi)
  })

  it('rơi về bản tiếng Việt khi bản tiếng Đức rỗng', () => {
    expect(pickExamFeedback({ feedback_vi: 'Có bản Việt', feedback_de: '   ' }, 'de')).toBe('Có bản Việt')
  })

  it('rơi về bản tiếng Đức khi bản tiếng Việt thiếu', () => {
    expect(pickExamFeedback({ feedback_de: 'Nur Deutsch' }, 'vi')).toBe('Nur Deutsch')
  })

  it('trả undefined khi không có bản nào hoặc không có dữ liệu chấm', () => {
    expect(pickExamFeedback({ feedback_vi: '', feedback_de: null }, 'de')).toBeUndefined()
    expect(pickExamFeedback(null, 'de')).toBeUndefined()
    expect(pickExamFeedback(undefined, 'vi')).toBeUndefined()
  })
})
