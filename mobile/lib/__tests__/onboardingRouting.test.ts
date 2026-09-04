// Khoá quyết định điều hướng sau khi lưu hồ sơ onboarding.
//
// Test này tồn tại vì một lỗi thật (QA 2026-08-20, F-1): guard
// `postAction === 'EMAIL_CAPTURE_UPSELL' && !PRO_UNLOCKED_FREE` đảo nghĩa khi
// `IAP_ENABLED` bị lật sang true, khiến học viên A0 trên iOS bị đá sang màn
// upsell email và bỏ qua TOÀN BỘ onboarding v1 (wow first-sentence, spotlight
// tour, checklist tuần đầu, nhắc học 20:00). Lỗi sống hơn 6 tuần vì không có
// test nào chạm vào quyết định điều hướng.
//
// Bất biến: MỌI học viên đều đi qua màn wow trước khi vào app. Từ soát 02/09
// (F-21, quyết định Q-A): client không còn đọc `postAction` — hàm hết tham số,
// nên bất biến giờ là tuyệt đối theo chữ ký kiểu. Test giữ lại làm chốt: ai
// muốn tái-rẽ-nhánh theo dữ liệu route API sẽ phải sửa cả chữ ký lẫn file này.

import { nextAfterProfile } from '../onboardingRouting'

describe('nextAfterProfile', () => {
  test('luôn đi qua màn wow first-sentence — không có nhánh nào khác', () => {
    // Arrange + Act
    const target = nextAfterProfile()

    // Assert
    expect(target).toBe('/(auth)/first-sentence')
    expect(target).not.toBe('/(student)/speaking') // hồi quy F-1
  })

  test('không nhận tham số: quyết định không được phép phụ thuộc dữ liệu route API', () => {
    expect(nextAfterProfile.length).toBe(0)
  })
})
