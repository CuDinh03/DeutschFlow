import { describe, it, expect, vi } from 'vitest'
import realChromeVi from '../../messages/v2/chrome.vi.json'

/**
 * W2 audit lag 02/09: mỗi provider chỉ được mang lõi chrome + phần khu của nó — test này khoá
 * hợp đồng cắt catalog (loại khu lạ, pick được nhánh sâu).
 *
 * 07/09: base cũng cắt theo khai báo `base:<ns>`. Trước đó base đi kèm nguyên vẹn ở MỌI provider,
 * mà `speaking` một mình đã 14KB và chỉ khu student đọc — landing/đăng nhập/teacher/org/admin cõng
 * không công trong HTML từng lượt tải.
 *
 * ⚠️ Hình dạng mock PHẢI phản chiếu request.ts THẬT: chrome.<locale>.json được merge PHẲNG vào
 * root `v2` (các nhóm nav/shell/common/error/maintenance nằm NGANG với student/teacher/…), KHÔNG
 * có node `v2.chrome`. Bản mock đầu tiên bịa ra node lồng `chrome: {...}` nên V2_CORE hard-code
 * 'chrome' vẫn xanh — trong khi prod pick trượt toàn bộ nav/shell/common/error và hiện nguyên
 * khoá thô (v2.shell.logout, v2.common.start…) ở mọi khu. Cụm test cuối vì thế dựng catalog từ
 * CHÍNH chrome.vi.json thật thay vì tin mock.
 */
const MOCK_CATALOG: Record<string, unknown> = {
  learn: { title: 'bài học' },
  nav: { home: 'trang chủ' },
  v2: {
    // — các nhóm chrome (merge phẳng, như request.ts thật) —
    nav: { roles: { student: 'Học viên' } },
    shell: { logout: 'Đăng xuất' },
    common: { ok: 'OK' },
    error: { title: 'Trang gặp lỗi' },
    maintenance: { overlayTitle: 'Hệ thống đang bảo trì' },
    // — các khu —
    student: {
      dashboard: { hello: 'chào' },
      examSpeaking: { room: { start: 'bắt đầu' } },
      micGuide: { open: 'mở' },
    },
    teacher: { grading: { queue: 'hàng chờ' } },
    org: { accept: { join: 'tham gia' }, billing: { pay: 'trả' } },
  },
}

let catalog: Record<string, unknown> = MOCK_CATALOG
vi.mock('next-intl/server', () => ({
  getMessages: async () => catalog,
}))

import { messagesForV2Areas } from './pickV2Messages'

type M = Record<string, unknown>

describe('messagesForV2Areas', () => {
  it('base KHÔNG tự đi kèm — không khai `base:` thì provider không mang catalog gốc', async () => {
    // Hợp đồng đổi 07/09: `speaking` (14KB) chỉ khu student cần, nhưng trước đó mọi trang —
    // landing, đăng nhập, teacher, org, admin — đều cõng nguyên base trong HTML.
    const m = (await messagesForV2Areas('student')) as M
    expect(m.learn).toBeUndefined()
    expect(m.nav).toBeUndefined()
  })

  it("khai 'base:<ns>' thì đúng namespace đó có mặt, các namespace gốc khác thì không", async () => {
    const m = (await messagesForV2Areas('student', 'base:learn')) as M
    expect(m.learn).toEqual({ title: 'bài học' })
    expect(m.nav).toBeUndefined()
    // Khai base không được lẫn vào phần v2.
    expect((m.v2 as M).learn).toBeUndefined()
  })

  it('nhiều namespace gốc cùng lúc, và tên lạ thì bỏ qua êm', async () => {
    const m = (await messagesForV2Areas('student', 'base:learn', 'base:nav', 'base:khongCo')) as M
    expect(m.learn).toEqual({ title: 'bài học' })
    expect(m.nav).toEqual({ home: 'trang chủ' })
    expect('khongCo' in m).toBe(false)
  })

  it('luôn kèm lõi chrome (nav/shell/common/error), pick đúng khu được nêu, loại khu lạ', async () => {
    const m = (await messagesForV2Areas('student')) as M
    const v2 = m.v2 as M
    expect(v2.nav).toEqual({ roles: { student: 'Học viên' } })
    expect(v2.shell).toEqual({ logout: 'Đăng xuất' })
    expect(v2.common).toEqual({ ok: 'OK' })
    expect(v2.error).toEqual({ title: 'Trang gặp lỗi' })
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
    expect(v2.shell).toBeDefined()
  })

  it('maintenance thuộc lõi — mọi provider đều mang (overlay/banner chạy khắp nơi)', async () => {
    const m = (await messagesForV2Areas('teacher')) as M
    const v2 = m.v2 as M
    expect(v2.maintenance).toEqual({ overlayTitle: 'Hệ thống đang bảo trì' })
  })
})

describe('lõi chrome — hồi quy trên file chrome.vi.json THẬT (không tin mock)', () => {
  it('mọi nhóm top-level của chrome.vi.json đều được giao cho provider của từng khu', async () => {
    // Dựng catalog đúng cách request.ts làm: merge PHẲNG chrome vào root v2.
    catalog = { v2: { ...(realChromeVi as M), student: { dashboard: { hello: 'chào' } } } }
    try {
      for (const areas of [['student'], ['teacher'], ['adminOps', 'adminContent'], ['org'], []]) {
        const m = (await messagesForV2Areas(...areas)) as M
        const v2 = m.v2 as M
        for (const group of Object.keys(realChromeVi)) {
          expect(v2[group], `nhóm chrome '${group}' phải có mặt ở provider [${areas.join(', ')}]`).toEqual(
            (realChromeVi as M)[group],
          )
        }
      }
    } finally {
      catalog = MOCK_CATALOG
    }
  })

  it('ba khoá từng lộ nguyên đường dẫn trên prod resolve ra chuỗi thật', async () => {
    catalog = { v2: { ...(realChromeVi as M) } }
    try {
      const m = (await messagesForV2Areas('student')) as M
      const v2 = m.v2 as M
      expect((v2.shell as M).logout).toBeTypeOf('string')
      expect((v2.shell as M).mainNav).toBeTypeOf('string')
      expect(((v2.nav as M).roles as M).student).toBeTypeOf('string')
      expect((v2.common as M).start).toBeTypeOf('string')
    } finally {
      catalog = MOCK_CATALOG
    }
  })
})
