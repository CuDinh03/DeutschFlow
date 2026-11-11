import { describe, expect, it } from 'vitest'
import { safeNext } from './safeNext'

describe('safeNext — đường dẫn chuyển hướng nội bộ', () => {
  it('nhận đường dẫn nội bộ, giữ query và hash', () => {
    expect(safeNext('/v2/student/dashboard/')).toBe('/v2/student/dashboard/')
    expect(safeNext('/v2/admin/users/?tab=pending&page=2#row-7')).toBe('/v2/admin/users/?tab=pending&page=2#row-7')
    expect(safeNext('/')).toBe('/')
  })

  it('giữ nguyên phần đã mã hoá phần trăm hợp lệ', () => {
    expect(safeNext('/v2/student/vocabulary/?topic=Stra%C3%9Fe')).toBe('/v2/student/vocabulary/?topic=Stra%C3%9Fe')
    expect(safeNext('/v2/x/?next=%2Fv2%2Fy')).toBe('/v2/x/?next=%2Fv2%2Fy')
  })

  it('chuẩn hoá các đoạn "." và ".."', () => {
    expect(safeNext('/v2/student/../admin/users')).toBe('/v2/admin/users')
  })

  it('chuỗi mã hoá hỏng vẫn được soát theo dạng thô', () => {
    expect(safeNext('/v2/student/search/?q=100%')).toBe('/v2/student/search/?q=100%')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chuỗi rỗng', ''],
    ['không bắt đầu bằng "/"', 'v2/student/dashboard'],
    ['hai gạch chéo đầu', '//example.com'],
    ['hai gạch chéo đầu kèm đường dẫn', '//example.com/v2/student/'],
    ['ba gạch chéo đầu', '///example.com'],
    ['gạch chéo ngược sau "/"', '/\\example.com'],
    ['gạch chéo ngược ở giữa', '/v2/student/\\example.com'],
    ['gạch chéo ngược mã hoá', '/%5Cexample.com'],
    ['gạch chéo ngược mã hoá chữ thường', '/%5cexample.com'],
    ['gạch chéo ngược mã hoá hai lớp', '/%255Cexample.com'],
    ['gạch chéo thứ hai mã hoá', '/%2Fexample.com'],
    ['gạch chéo thứ hai mã hoá hai lớp', '/%252Fexample.com'],
    ['tab thô sau "/"', '/\t/example.com'],
    ['xuống dòng thô sau "/"', '/\n/example.com'],
    ['CR thô sau "/"', '/\r/example.com'],
    ['tab mã hoá sau "/"', '/%09/example.com'],
    ['xuống dòng mã hoá sau "/"', '/%0A/example.com'],
    ['CR mã hoá sau "/"', '/%0d/example.com'],
    ['ký tự NUL mã hoá', '/v2/%00'],
    ['ký tự DEL', '/v2/\u007f'],
    ['URL tuyệt đối https', 'https://example.com/v2/student/'],
    ['URL tuyệt đối http', 'http://example.com'],
    ['lược đồ javascript', 'javascript:alert(1)'],
    ['lược đồ data', 'data:text/html,x'],
    ['khoảng trắng đầu chuỗi', ' /v2/student/'],
  ])('từ chối: %s', (_label, input) => {
    expect(safeNext(input)).toBeNull()
  })
})
