import { redirect } from 'next/navigation'

/**
 * `/v2/teacher/profile` — tàn dư v1, chuyển hướng về hồ sơ dùng chung.
 *
 * V-12b (08/09/2026): route này còn sống nhưng MỒ CÔI khỏi sidebar từ trước Wave 1 — mục "Hồ sơ"
 * của giáo viên trỏ `/v2/profile`, vì bản riêng cho giáo viên KHÔNG có form đổi mật khẩu (giáo viên
 * là vai duy nhất không đổi được mật khẩu, xem ghi chú ở nav.ts và src/app/v2/profile/page.tsx).
 * Giữ một màn hồ sơ thứ hai, nghèo tính năng hơn, chỉ có hại: ai còn bookmark cũ sẽ tưởng nền tảng
 * không cho đổi mật khẩu. Chuyển hướng thay vì xoá để bookmark cũ vẫn tới đúng chỗ.
 */
export default function V2TeacherProfileRedirect() {
  redirect('/v2/profile')
}
