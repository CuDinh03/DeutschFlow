/**
 * examSpeakingApi.audioTurn — hợp đồng multipart, chạy qua instance axios THẬT (chỉ thay adapter).
 *
 * Hai bẫy nằm sát nhau và test này canh cả hai:
 *
 *   1. Đặt tay `Content-Type: multipart/form-data` là gửi một header KHÔNG có `boundary`.
 *      Chỉ trình duyệt mới sinh được boundary lúc tuần tự hoá FormData, nên header đặt tay
 *      hoặc bị axios ném đi (may) hoặc tới server như một multipart không phân tích được (rủi).
 *
 *   2. Nhưng bỏ trắng `headers` cũng KHÔNG đúng: instance trong `@/lib/api` mặc định
 *      `Content-Type: application/json`, mà `transformRequest` của axios đọc đúng header đó
 *      (defaults/index.js: `hasJSONContentType`) và sẽ **JSON-hoá FormData** — bản ghi âm biến
 *      thành `{}` và lượt nói mất trắng. Phải unset tường minh cho riêng request này.
 *
 * Vì thế assert quan trọng nhất ở đây là: body tới adapter vẫn còn LÀ FormData.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import api from '@/lib/api'
import { examSpeakingApi } from '@/lib/examSpeakingApi'

let captured: InternalAxiosRequestConfig | null = null
const originalAdapter = api.defaults.adapter

/** jsdom ở cấu hình này không có Storage dùng được; interceptor của api.ts lại đọc token từ đó. */
const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }

beforeEach(() => {
  captured = null
  vi.stubGlobal('localStorage', emptyStorage)
  vi.stubGlobal('sessionStorage', emptyStorage)
  api.defaults.adapter = async (config) => {
    captured = config as InternalAxiosRequestConfig
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config: config as InternalAxiosRequestConfig }
  }
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})

/** Content-Type thực sự đi kèm request (AxiosHeaders trả `false` cho header đã bị unset). */
function contentType(config: InternalAxiosRequestConfig): unknown {
  return config.headers.getContentType()
}

describe('audioTurn — multipart', () => {
  it('giữ nguyên FormData tới adapter (KHÔNG bị transformRequest JSON-hoá)', async () => {
    const blob = new Blob([new Uint8Array(2048)], { type: 'audio/mp4' })
    await examSpeakingApi.audioTurn(7, blob, 'turn.m4a', 'vi')

    expect(captured).toBeTruthy()
    expect(captured!.data).toBeInstanceOf(FormData)
    expect(typeof captured!.data).not.toBe('string')

    const form = captured!.data as FormData
    const sent = form.get('audio')
    expect(sent).toBeInstanceOf(Blob)
    expect((sent as Blob).size).toBe(2048)
    expect((form.get('audio') as File).name).toBe('turn.m4a')
  })

  it('KHÔNG tự đặt Content-Type — để trình duyệt gắn boundary', async () => {
    await examSpeakingApi.audioTurn(7, new Blob([new Uint8Array(8)], { type: 'audio/webm' }))

    const ct = contentType(captured!)
    // `false`/rỗng = header đã được gỡ; điều cấm là để lại multipart đặt tay hoặc json.
    expect(ct === false || ct === undefined || ct === '' || ct == null).toBe(true)
    expect(String(ct)).not.toContain('multipart/form-data')
    expect(String(ct)).not.toContain('application/json')
  })

  it('vẫn gửi đúng đường dẫn, lang và trần thời gian riêng cho lượt nói', async () => {
    await examSpeakingApi.audioTurn(42, new Blob([new Uint8Array(8)], { type: 'audio/webm' }), 'turn.webm', 'de')

    expect(captured!.url).toBe('/speaking/exam/sessions/42/turns')
    expect(captured!.method).toBe('post')
    expect(captured!.params).toEqual({ lang: 'de' })
    expect(captured!.timeout).toBe(45_000)
  })

  it('lượt text vẫn là JSON (không bị fix multipart làm hỏng)', async () => {
    await examSpeakingApi.textTurn(7, 'Ich heiße Anna.', 'vi')

    expect(typeof captured!.data).toBe('string')
    expect(JSON.parse(captured!.data as string)).toEqual({ transcript: 'Ich heiße Anna.' })
    expect(String(contentType(captured!))).toContain('application/json')
  })
})
