// Điểm quyết định DUY NHẤT cho "mở app thì vào đâu" (M0, Đợt 3 kế hoạch onboarding 17/09, cổng G-1).
//
// Trước Đợt 3 app mở thẳng vào màn Đăng nhập; lối "Học thử" nằm sau cờ PostHog
// `onboarding-value-first` mặc định TẮT — tức phễu khách (value-first, Q1 28/08) chưa bao giờ tới
// người dùng thật (gap M-0). Nay: chưa đăng nhập ⇒ màn Chào mừng (`WELCOME` của máy trạng thái),
// đã đăng nhập ⇒ Trang chủ (cổng quay lại `hasPlan` nằm ở login/register, không ở đây).
//
// Hàm thuần có test — cùng triết lý chống-F-1 với `nextAfterProfile()`: quyết định điều hướng
// nằm trong JSX thì không test nào bắt được khi nó lặng lẽ đổi nghĩa.

export type EntryHref = '/(student)' | '/(auth)/welcome'

export function entryHrefFor(state: { isLoggedIn: boolean }): EntryHref {
  return state.isLoggedIn ? '/(student)' : '/(auth)/welcome'
}
