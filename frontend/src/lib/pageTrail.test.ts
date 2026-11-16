/**
 * Trang trước trong cùng tab (nghiệm thu góp ý 17/11): form góp ý từng lấy "trang đang mở" từ
 * `document.referrer`, mà chuyển trang phía client không đổi referrer — góp ý của học viên ghi
 * trang admin của phiên trước trong cùng tab.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { notePageView, previousPage } from './pageTrail'

describe('pageTrail', () => {
  beforeEach(() => sessionStorage.clear())

  it('trả trang ngay trước trang hiện tại', () => {
    notePageView('/v2/student/dashboard/')
    notePageView('/v2/feedback/')
    expect(previousPage('/v2/feedback/')).toBe('/v2/student/dashboard/')
  })

  it('tải lại cùng trang không đẩy trang trước đi mất', () => {
    notePageView('/v2/student/dashboard/')
    notePageView('/v2/feedback/')
    notePageView('/v2/feedback/')
    expect(previousPage('/v2/feedback/')).toBe('/v2/student/dashboard/')
  })

  it('chỉ nhớ chuỗi mới nhất: đăng nhập tài khoản khác thì trang admin cũ không còn là trang trước', () => {
    notePageView('/v2/admin/feedback/')
    notePageView('/v2/login/')
    notePageView('/v2/student/dashboard/')
    notePageView('/v2/feedback/')
    expect(previousPage('/v2/feedback/')).toBe('/v2/student/dashboard/')
  })

  it('chưa có trang trước thì trả null', () => {
    notePageView('/v2/feedback/')
    expect(previousPage('/v2/feedback/')).toBeNull()
  })

  it('trang hiện tại khác trang đã ghi cuối thì trang đã ghi cuối là trang trước', () => {
    notePageView('/v2/student/roadmap/')
    expect(previousPage('/v2/feedback/')).toBe('/v2/student/roadmap/')
  })
})
