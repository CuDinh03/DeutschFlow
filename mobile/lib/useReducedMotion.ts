// Cầu nối tới cài đặt "Giảm chuyển động" của hệ điều hành.
//
// Onboarding v1 có ba chỗ chuyển động mạnh hoặc không giới hạn: confetti 26 mảnh
// lúc ăn mừng, vòng sáng quanh avatar mentor lặp vô hạn (chạm WCAG 2.2.2 — nội
// dung chuyển động quá 5 giây mà không có nút dừng), và khung khoét sáng nhảy
// giữa 5 bước tour bằng spring. Trước đây không chỗ nào đọc cài đặt hệ thống cả
// (QA 2026-08-20, F-7).
//
// Bọc lại hook của reanimated thay vì dùng thẳng để có một chỗ duy nhất thay đổi
// nếu sau này cần theo dõi cài đặt theo thời gian thực.
//
// 🪤 Hook của reanimated đọc cài đặt LÚC APP KHỞI ĐỘNG và không re-render khi
// người dùng đổi cài đặt giữa chừng. Chấp nhận được: đây là cài đặt trợ năng,
// người dùng bật một lần rồi thôi, và lần mở app sau là đúng.

import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated'

/** true khi người dùng bật "Giảm chuyển động" trong Cài đặt trợ năng. */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion()
}
