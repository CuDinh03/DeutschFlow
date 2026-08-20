// Điểm quyết định DUY NHẤT cho "sau khi lưu hồ sơ onboarding thì đi đâu".
//
// Onboarding v1 (plan 2026-07-17) định nghĩa lại luồng: màn wow "câu tiếng Đức
// đầu tiên" là BẮT BUỘC với mọi archetype, và mọi người đều đáp xuống Trang chủ
// để spotlight tour nổ. `postAction` từ GET /api/onboarding/route vì thế chỉ còn
// giá trị phân tích (analytics), KHÔNG còn là nhánh điều hướng.
//
// Trước đây quyết định này nằm rải rác trong hai nhánh của app/(auth)/onboarding.tsx
// và bị một cờ paywall gác. Khi `IAP_ENABLED` lật sang true (09/07), cờ đó đảo
// nghĩa và học viên A0 trên iOS lặng lẽ mất trọn onboarding v1 suốt hơn 6 tuần
// (QA 2026-08-20, F-1). Gom về một hàm thuần có test là để lần sau ai muốn
// tái-rẽ-nhánh thì buộc phải sửa test — không thể vô tình.

/** Màn tiếp theo sau khi POST /onboarding/profile thành công. */
export type PostProfileRoute = '/(auth)/first-sentence'

/**
 * @param postAction archetype backend trả về — nhận vào để test chứng minh được
 *   rằng KHÔNG giá trị nào (kể cả `EMAIL_CAPTURE_UPSELL`) thoát được màn wow.
 */
export function nextAfterProfile(postAction?: string): PostProfileRoute {
  void postAction
  return '/(auth)/first-sentence'
}
