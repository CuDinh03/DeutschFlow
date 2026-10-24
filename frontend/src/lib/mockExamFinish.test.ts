import { describe, it, expect } from 'vitest'
import { isAttemptAlreadyFinished } from './mockExamFinish'

describe('isAttemptAlreadyFinished', () => {
  it('chỉ nhận đúng 409 ATTEMPT_NOT_IN_PROGRESS', () => {
    expect(isAttemptAlreadyFinished({ response: { status: 409, data: { error: 'ATTEMPT_NOT_IN_PROGRESS' } } })).toBe(true)
    expect(isAttemptAlreadyFinished({ response: { status: 409, data: { error: 'OTHER' } } })).toBe(false)
    expect(isAttemptAlreadyFinished({ response: { status: 500, data: { error: 'ATTEMPT_NOT_IN_PROGRESS' } } })).toBe(false)
    expect(isAttemptAlreadyFinished(new Error('Network Error'))).toBe(false)
    expect(isAttemptAlreadyFinished(null)).toBe(false)
  })
})
