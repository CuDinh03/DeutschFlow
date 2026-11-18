// Cổng ngôn ngữ cho thanh tab học viên (owner chốt 10/09/2026: mỗi ngôn ngữ thuần
// một thứ tiếng — bỏ lối "nhãn Đức + dòng nghĩa"). Bản mobile chỉ có tiếng Việt.
//
// Test khoá đúng CHỮ, vì đây là chữ web đang dùng ở `nav.areas`
// (frontend/messages/v2/chrome.vi.json) — hai đầu phải gọi cùng một tên.

import { TAB_LABELS } from '@/lib/tabLabels'

// Từ ngoại từng xuất hiện trên thanh tab hoặc dễ lọt lại vào đây.
const TU_NGOAI = [
  'Heute', 'Lernen', 'Sprechen', 'Profil', 'Übersicht',
  'Speaking', 'Home', 'Today', 'Learn', 'Profile', 'Weekly',
]

describe('TAB_LABELS — nhãn 5 tab học viên', () => {
  test('đúng bộ tab của khu học viên trên web (owner chốt 18/11/2026)', () => {
    expect(TAB_LABELS).toEqual({
      index: 'Hôm nay',
      learn: 'Học',
      speaking: 'Luyện nói',
      exam: 'Luyện thi',
      stats: 'Tiến bộ',
    })
  })

  test('đúng thứ tự trên thanh tab', () => {
    expect(Object.keys(TAB_LABELS)).toEqual(['index', 'learn', 'speaking', 'exam', 'stats'])
  })

  test('không nhãn nào lẫn tiếng Đức hoặc tiếng Anh', () => {
    for (const [route, nhan] of Object.entries(TAB_LABELS)) {
      for (const tu of TU_NGOAI) {
        expect(`${route}: ${nhan}`).not.toContain(tu)
      }
    }
  })

  test('mỗi nhãn có ít nhất một chữ cái tiếng Việt hoặc là từ thuần Việt', () => {
    // Bắt trường hợp nhãn bị thay bằng chuỗi rỗng / mã route / chữ không dấu lạ.
    for (const nhan of Object.values(TAB_LABELS)) {
      expect(nhan.trim().length).toBeGreaterThan(0)
      expect(nhan).toMatch(/^[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ ]*$/)
    }
  })
})
