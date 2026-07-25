import { AxiosError, AxiosHeaders } from 'axios'
import {
  apiErrorCode,
  apiStatusLabel,
  normalizeEndpoint,
  shouldReportApiFailure,
} from '../lib/api'

/**
 * Audit speaking 24/07 — R-M6 (mù telemetry): trước đây mọi lỗi đã catch chỉ dẫn tới `Alert.alert`,
 * còn log API bị bọc trong `__DEV__`, nên KHÔNG có số liệu nào về tần suất 503/timeout thật trên
 * prod — đêm 23/07 không ai biết có sự cố cho tới khi người dùng chụp màn hình gửi.
 *
 * Bộ test chốt phần thuần logic của lớp telemetry: nhãn status, mã lỗi backend, gộp endpoint, và
 * bộ lọc "lỗi nào đáng báo cáo".
 */

function axiosError(opts: {
  status?: number
  data?: unknown
  code?: string
  message?: string
  url?: string
}): AxiosError {
  const err = new AxiosError(opts.message ?? 'boom', opts.code)
  if (opts.status != null) {
    err.response = {
      status: opts.status,
      statusText: '',
      data: opts.data,
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    }
  }
  err.config = { headers: new AxiosHeaders(), url: opts.url, method: 'post' }
  return err
}

describe('apiStatusLabel', () => {
  it('trả mã HTTP khi có response', () => {
    expect(apiStatusLabel(axiosError({ status: 503 }))).toBe('503')
    expect(apiStatusLabel(axiosError({ status: 429 }))).toBe('429')
  })

  it('timeout không có response → nhãn "timeout", không phải "unknown"', () => {
    expect(apiStatusLabel(axiosError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })))
      .toBe('timeout')
  })

  it('mất mạng → nhãn "network"', () => {
    expect(apiStatusLabel(axiosError({ message: 'Network Error' }))).toBe('network')
  })

  it('lỗi không phải axios → "unknown"', () => {
    expect(apiStatusLabel(new Error('boom'))).toBe('unknown')
  })
})

describe('apiErrorCode', () => {
  it('đọc `code` của ProblemDetail để tag theo mã backend', () => {
    expect(apiErrorCode(axiosError({ status: 503, data: { code: 'AI_BUSY', detail: 'Trợ lý AI đang bận.' } })))
      .toBe('AI_BUSY')
  })

  it('không có code → undefined, không bịa chuỗi', () => {
    expect(apiErrorCode(axiosError({ status: 500, data: { detail: 'lỗi' } }))).toBeUndefined()
    expect(apiErrorCode(axiosError({ status: 500 }))).toBeUndefined()
    expect(apiErrorCode(axiosError({ status: 500, data: { code: '   ' } }))).toBeUndefined()
  })
})

describe('normalizeEndpoint', () => {
  it('gộp id số để không nổ cardinality tag', () => {
    expect(normalizeEndpoint('/ai-speaking/sessions/8421/chat')).toBe('/ai-speaking/sessions/{id}/chat')
    expect(normalizeEndpoint('/classes/12/students/34')).toBe('/classes/{id}/students/{id}')
  })

  it('bỏ query string (có thể mang dữ liệu người dùng)', () => {
    expect(normalizeEndpoint('/search?q=hallo%20welt')).toBe('/search')
  })

  it('url rỗng → "unknown"', () => {
    expect(normalizeEndpoint(undefined)).toBe('unknown')
  })
})

describe('shouldReportApiFailure', () => {
  it('báo cáo 5xx, 429, timeout và mất mạng — đúng chùm triệu chứng đêm 23/07', () => {
    expect(shouldReportApiFailure(axiosError({ status: 503 }))).toBe(true)
    expect(shouldReportApiFailure(axiosError({ status: 500 }))).toBe(true)
    expect(shouldReportApiFailure(axiosError({ status: 429 }))).toBe(true)
    expect(shouldReportApiFailure(axiosError({ code: 'ECONNABORTED' }))).toBe(true)
    expect(shouldReportApiFailure(axiosError({ message: 'Network Error' }))).toBe(true)
  })

  it('BỎ QUA 401 (đường refresh tự xử lý) và 4xx từ chối có chủ đích — tránh nhiễu tín hiệu', () => {
    expect(shouldReportApiFailure(axiosError({ status: 401 }))).toBe(false)
    expect(shouldReportApiFailure(axiosError({ status: 400 }))).toBe(false)
    expect(shouldReportApiFailure(axiosError({ status: 403 }))).toBe(false)
    expect(shouldReportApiFailure(axiosError({ status: 404 }))).toBe(false)
  })

  it('lỗi không phải axios không đi qua đường API → false', () => {
    expect(shouldReportApiFailure(new Error('boom'))).toBe(false)
  })
})
