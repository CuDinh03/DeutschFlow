import { afterEach, describe, expect, it, vi } from 'vitest'
import { TIMEZONE_OPTIONS, canonicalTimezone, timezoneOptionsFor } from './timezones'

function mockDeviceZone(zone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone: zone }),
  } as unknown as Intl.DateTimeFormat)
}

afterEach(() => vi.restoreAllMocks())

describe('timezoneOptionsFor', () => {
  it('giữ nguyên danh sách chuẩn khi zone đang lưu đã nằm trong đó', () => {
    mockDeviceZone('Asia/Ho_Chi_Minh')
    expect(timezoneOptionsFor('Europe/Berlin')).toEqual([...TIMEZONE_OPTIONS])
  })

  it('bổ sung zone đang lưu nếu nó không nằm trong danh sách chuẩn', () => {
    mockDeviceZone('Asia/Ho_Chi_Minh')
    const options = timezoneOptionsFor('Europe/Prague')
    // Thiếu dòng này thì ô chọn tự nhảy sang zone khác và ghi đè cài đặt của người dùng.
    expect(options).toContain('Europe/Prague')
  })

  it('bổ sung zone của thiết bị để người dùng chọn được bằng một cú nhấp', () => {
    mockDeviceZone('America/Bogota')
    expect(timezoneOptionsFor(null)).toContain('America/Bogota')
  })

  it('không lặp khi zone đang lưu trùng zone thiết bị', () => {
    mockDeviceZone('Europe/Prague')
    const options = timezoneOptionsFor('Europe/Prague')
    expect(options.filter((zone) => zone === 'Europe/Prague')).toHaveLength(1)
  })

  it('không vỡ khi trình duyệt không trả về múi giờ', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('not supported')
    })
    expect(timezoneOptionsFor(null)).toEqual([...TIMEZONE_OPTIONS])
  })
})

describe('canonicalTimezone', () => {
  it('quy tên cũ về tên chuẩn đang dùng trong danh sách', () => {
    expect(canonicalTimezone('Asia/Saigon')).toBe('Asia/Ho_Chi_Minh')
  })

  it('giữ nguyên tên không nằm trong bảng alias', () => {
    expect(canonicalTimezone('Europe/Prague')).toBe('Europe/Prague')
  })
})

describe('alias không tạo dòng trùng', () => {
  it('máy báo Asia/Saigon thì ô chọn KHÔNG có thêm dòng thứ hai cho cùng múi giờ', () => {
    // Bẫy thật gặp lúc nghiệm thu: macOS báo Asia/Saigon nên danh sách hiện cả hai tên.
    mockDeviceZone('Asia/Saigon')
    const options = timezoneOptionsFor('Asia/Ho_Chi_Minh')
    expect(options).toEqual([...TIMEZONE_OPTIONS])
    expect(options).not.toContain('Asia/Saigon')
  })
})
