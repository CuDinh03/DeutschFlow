// Refresh hỏng: phân biệt "phiên đã chết" với "hạ tầng trục trặc".
//
// Vì sao quan trọng: nhánh retry thoáng qua của interceptor CHỈ áp cho GET
// (lib/api.ts), còn refresh là POST — nên một 502 lúc blue-green deploy rơi vào
// đúng nhánh catch như refresh token hết hạn thật.
//
// M2 audit lag 02/09 NÂNG vai trò của hàm này: trước nó chỉ gate việc dọn
// trạng thái per-thiết bị (logout thì catch nào cũng làm); giờ nó gate CẢ việc
// logout — hạ tầng trục trặc thì GIỮ token + user, chỉ reject request gốc, để
// một brownout nửa phút không đăng xuất cả cohort mobile (rồi bão re-login dồn
// thêm tải đúng lúc backend yếu nhất).

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
    // Ca blue-green deploy / brownout: logout ở đây là đăng xuất oan người còn quyền
    // (M2) và xoá dữ liệu per-thiết bị của họ.
    expect(isSessionDefinitelyOver(axiosErrWithStatus(st))).toBe(false)
  })

  test('timeout / mất sóng (không có response) → KHÔNG được coi là phiên chết', () => {
    const headers = new AxiosHeaders()
    const timeout = new AxiosError('timeout', 'ECONNABORTED', { headers })
    expect(isSessionDefinitelyOver(timeout)).toBe(false)
  })

  test('response hỏng (invalid_refresh_response) → phiên kết thúc (đổi chủ đích ở M2)', () => {
    // Trước M2 hàm chỉ gate việc dọn state nên ca này để false (thận trọng, đằng nào cũng
    // logout). Giờ hàm gate CẢ logout: false nghĩa là GIỮ token cũ → mọi request 401 → refresh
    // lại trả 200-thiếu-token → người dùng KẸT trong vòng lặp không lối thoát. Logout (kèm dọn)
    // là lối thoát đúng khi server vỡ hợp đồng.
    expect(isSessionDefinitelyOver(new Error('invalid_refresh_response'))).toBe(true)
  })
})
