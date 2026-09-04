import { describe, expect, it } from 'vitest'
import { AsyncJobError } from '@/lib/asyncJob'
import { classifyPracticeError } from './practiceError'

const http = (status: number, data?: unknown, headers?: Record<string, unknown>) => ({
  response: { status, data, headers },
})

describe('classifyPracticeError', () => {
  it('409 → conflict, giữ detail của ProblemDetail', () => {
    expect(classifyPracticeError(http(409, { detail: 'Đang sinh đề' }))).toEqual({
      kind: 'conflict',
      detail: 'Đang sinh đề',
      retryAfterSeconds: null,
    })
  })

  it('429 → quota, đọc retryAfterSeconds từ body rồi header', () => {
    expect(classifyPracticeError(http(429, { retryAfterSeconds: 12 })).retryAfterSeconds).toBe(12)
    expect(classifyPracticeError(http(429, {}, { 'retry-after': '30' })).retryAfterSeconds).toBe(30)
    expect(classifyPracticeError(http(429, { detail: 'Hết lượt' })).kind).toBe('quota')
  })

  it('503 → aiUnavailable', () => {
    expect(classifyPracticeError(http(503)).kind).toBe('aiUnavailable')
  })

  it('AsyncJobError → jobFailed kèm thông điệp job', () => {
    expect(classifyPracticeError(new AsyncJobError('LLM timeout'))).toEqual({
      kind: 'jobFailed',
      detail: 'LLM timeout',
      retryAfterSeconds: null,
    })
  })

  it('lỗi mạng / 500 / rác → generic, không ném', () => {
    expect(classifyPracticeError(new Error('Network Error')).kind).toBe('generic')
    expect(classifyPracticeError(http(500)).kind).toBe('generic')
    expect(classifyPracticeError(null).kind).toBe('generic')
    expect(classifyPracticeError(undefined).kind).toBe('generic')
  })
})
