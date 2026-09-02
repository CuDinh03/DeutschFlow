import { describe, it, expect, vi } from 'vitest'

// W2 audit lag 02/09: mỗi provider chỉ được mang chrome + phần khu của nó — test này khoá
// hợp đồng cắt catalog (giữ base nguyên vẹn, loại khu lạ, pick được nhánh sâu).
vi.mock('next-intl/server', () => ({
  getMessages: async () => ({
    learn: { title: 'bài học' },
    nav: { home: 'trang chủ' },
    v2: {
      chrome: { nav: { roles: { student: 'Học viên' } }, common: { ok: 'OK' } },
      maintenance: { overlayTitle: 'Hệ thống đang bảo trì' },
      student: {
        dashboard: { hello: 'chào' },
        examSpeaking: { room: { start: 'bắt đầu' } },
        micGuide: { open: 'mở' },
      },
      teacher: { grading: { queue: 'hàng chờ' } },
      org: { accept: { join: 'tham gia' }, billing: { pay: 'trả' } },
    },
  }),
}))

import { messagesForV2Areas } from './pickV2Messages'

type M = Record<string, unknown>

describe('messagesForV2Areas', () => {
  it('giữ nguyên base (catalog legacy) ở mọi provider', async () => {
    const m = (await messagesForV2Areas('student')) as M
    expect(m.learn).toEqual({ title: 'bài học' })
    expect(m.nav).toEqual({ home: 'trang chủ' })
  })

  it('luôn kèm chrome, pick đúng khu được nêu, loại khu lạ', async () => {
    const m = (await messagesForV2Areas('student')) as M
    const v2 = m.v2 as M
    expect(v2.chrome).toBeDefined()
    expect((v2.student as M).dashboard).toEqual({ hello: 'chào' })
    expect(v2.teacher).toBeUndefined()
    expect(v2.org).toBeUndefined()
  })

  it('đường dẫn sâu chỉ kéo đúng nhánh con, không kéo cả khu', async () => {
    const m = (await messagesForV2Areas('adminOps', 'student.examSpeaking')) as M
    const v2 = m.v2 as M
    const student = v2.student as M
    expect(student.examSpeaking).toEqual({ room: { start: 'bắt đầu' } })
    expect(student.dashboard).toBeUndefined()
    expect(student.micGuide).toBeUndefined()
  })

  it('nhiều đường dẫn sâu cùng một khu được gộp vào một nhánh', async () => {
    const m = (await messagesForV2Areas('org.accept', 'student.micGuide')) as M
    const v2 = m.v2 as M
    expect((v2.org as M).accept).toEqual({ join: 'tham gia' })
    expect((v2.org as M).billing).toBeUndefined()
    expect((v2.student as M).micGuide).toEqual({ open: 'mở' })
  })

  it('khu không tồn tại trong catalog thì bỏ qua êm (không tạo key undefined)', async () => {
    const m = (await messagesForV2Areas('adminOps')) as M
    const v2 = m.v2 as M
    expect('adminOps' in v2).toBe(false)
    expect(v2.chrome).toBeDefined()
  })

  it('maintenance thuộc V2_CORE — mọi provider đều mang (overlay/banner chạy khắp nơi)', async () => {
    const m = (await messagesForV2Areas('teacher')) as M
    const v2 = m.v2 as M
    expect(v2.maintenance).toEqual({ overlayTitle: 'Hệ thống đang bảo trì' })
  })
})
