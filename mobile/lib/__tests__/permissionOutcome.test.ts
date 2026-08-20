// Phân loại kết quả xin quyền hệ thống thành 3 trạng thái mà UI xử lý khác nhau.
//
// Vì sao cần (QA 2026-08-20, F-14): iOS chỉ hiện hộp thoại quyền ĐÚNG MỘT LẦN.
// Sau khi user từ chối, `requestPermissionsAsync()` trả về ngay lập tức mà không
// hiện gì cả — code cũ coi đó là "denied" rồi im lặng vào cooldown 3 ngày, nên
// sheet nhắc học lặp vô hạn và KHÔNG BAO GIỜ bật được. Tách 'blocked' ra để UI
// biết phải chỉ đường vào Cài đặt thay vì hỏi lại vô nghĩa.

import { classifyPermission } from '../permissionOutcome'

describe('classifyPermission', () => {
  test('được cấp quyền → granted', () => {
    expect(classifyPermission({ granted: true, canAskAgain: true })).toBe('granted')
  })

  test('được cấp quyền, dù OS nói không hỏi lại được → vẫn granted', () => {
    // iOS trả canAskAgain=false sau khi user đã quyết định — granted phải thắng.
    expect(classifyPermission({ granted: true, canAskAgain: false })).toBe('granted')
  })

  test('chưa cấp nhưng còn hỏi lại được → denied (hỏi lại sau cooldown)', () => {
    expect(classifyPermission({ granted: false, canAskAgain: true })).toBe('denied')
  })

  test('chưa cấp và KHÔNG hỏi lại được → blocked (phải chỉ đường vào Cài đặt)', () => {
    expect(classifyPermission({ granted: false, canAskAgain: false })).toBe('blocked')
  })

  test('null/undefined (native lỗi) → blocked, không im lặng nuốt', () => {
    expect(classifyPermission(null)).toBe('blocked')
    expect(classifyPermission(undefined)).toBe('blocked')
  })
})
