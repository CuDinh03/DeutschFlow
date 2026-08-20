// Phân loại kết quả xin quyền hệ thống. Hàm thuần, không import expo/react-native
// để unit test chạy được trong môi trường node.
//
// Ba trạng thái vì UI phải xử lý khác nhau:
//   granted — xong, đặt lịch/đăng ký token.
//   denied  — user từ chối nhưng OS còn cho hỏi lại → hỏi lại sau cooldown.
//   blocked — OS không cho hỏi nữa (iOS chỉ hiện hộp thoại đúng một lần). Hỏi
//             tiếp là vô nghĩa: `requestPermissionsAsync()` trả về ngay, không
//             hiện gì. Phải chỉ đường cho user vào Cài đặt.

export type PermissionOutcome = 'granted' | 'denied' | 'blocked'

/** Chỉ hai trường cần thiết của `PermissionResponse` (expo-modules-core). */
export interface PermissionLike {
  granted: boolean
  canAskAgain: boolean
}

/**
 * `null`/`undefined` (native lỗi hoặc module chưa link) → 'blocked': coi như
 * không thể xin được, để caller hiện lối thoát thủ công thay vì nuốt im lặng.
 */
export function classifyPermission(status: PermissionLike | null | undefined): PermissionOutcome {
  if (!status) return 'blocked'
  if (status.granted) return 'granted'
  return status.canAskAgain ? 'denied' : 'blocked'
}
