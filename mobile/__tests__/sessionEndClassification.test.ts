// Refresh hỏng: phân biệt "phiên đã chết" với "hạ tầng trục trặc".
//
// Vì sao quan trọng: nhánh retry thoáng qua của interceptor CHỈ áp cho GET
// (lib/api.ts), còn refresh là POST — nên một 502 lúc blue-green deploy rơi vào
// đúng nhánh catch như refresh token hết hạn thật. Nếu dọn vô điều kiện thì một
// trục trặc vài giây sẽ xoá tour, checklist tuần đầu, mục tiêu phút/ngày VÀ huỷ
// lịch nhắc 20:00 trong OS của người mà refresh token còn hạn.

import { AxiosError, AxiosHeaders } from 'axios'
import { isSessionDefinitelyOver } from '@/lib/api'

function axiosErrWithStatus(status: number): AxiosError {
  const headers = new AxiosHeaders()
  const config = { headers }
  return new AxiosError('boom', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config,
  } as never)
}

describe('isSessionDefinitelyOver', () => {
  test('không còn refresh token trên máy → phiên đã chết', () => {
    expect(isSessionDefinitelyOver(new Error('no_refresh_token'))).toBe(true)
  })

  test.each([400, 401, 403])('backend từ chối refresh token (%i) → phiên đã chết', (st) => {
    expect(isSessionDefinitelyOver(axiosErrWithStatus(st))).toBe(true)
  })

  test.each([500, 502, 503, 504])('lỗi hạ tầng (%i) → KHÔNG được coi là phiên chết', (st) => {
    // Đây là ca blue-green deploy. Dọn ở đây là xoá dữ liệu của người còn quyền.
    expect(isSessionDefinitelyOver(axiosErrWithStatus(st))).toBe(false)
  })

  test('timeout / mất sóng (không có response) → KHÔNG được coi là phiên chết', () => {
    const headers = new AxiosHeaders()
    const timeout = new AxiosError('timeout', 'ECONNABORTED', { headers })
    expect(isSessionDefinitelyOver(timeout)).toBe(false)
  })

  test('response hỏng (invalid_refresh_response) → KHÔNG dọn, phiên có thể vẫn còn', () => {
    expect(isSessionDefinitelyOver(new Error('invalid_refresh_response'))).toBe(false)
  })
})
