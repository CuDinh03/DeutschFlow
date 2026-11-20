import { parseDraftAnswers, rememberAttemptDraft, takeAttemptDraft } from '../attemptDraft'

describe('attemptDraft', () => {
  it('bóc nháp: chỉ giữ chuỗi, JSON hỏng hoặc mảng thì rỗng', () => {
    expect(parseDraftAnswers('{"LV1-1":"a","email_1":"Liebe Anna","x":3}')).toEqual({ 'LV1-1': 'a', email_1: 'Liebe Anna' })
    expect(parseDraftAnswers('[1]')).toEqual({})
    expect(parseDraftAnswers('{hỏng')).toEqual({})
    expect(parseDraftAnswers(null)).toEqual({})
  })

  it('chuyển nháp cho màn làm bài đúng một lần', () => {
    rememberAttemptDraft(7, { a: 'b' })
    expect(takeAttemptDraft(7)).toEqual({ a: 'b' })
    expect(takeAttemptDraft(7)).toEqual({})
    rememberAttemptDraft(8, {})
    expect(takeAttemptDraft(8)).toEqual({})
  })
})
