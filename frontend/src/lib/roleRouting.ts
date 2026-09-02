/**
 * roleRouting — trang chủ sau đăng nhập, theo vai trò. NGUỒN SỰ THẬT DUY NHẤT cho trang đăng nhập.
 *
 * Vì sao tồn tại: mỗi trang login từng tự giữ một bản đồ riêng. Bản của `/v2/login` biết
 * OWNER/MANAGER, bản của `/login` (v1) thì KHÔNG — nên quản lý trung tâm đăng nhập ở `/login` rơi
 * vào nhánh mặc định và hạ cánh xuống dashboard HỌC VIÊN, chỉ được middleware đá ngược về
 * `/v2/org`. Một bản đồ, hết drift. Cây v1 đã bị xoá (Đợt 3), nên nay chỉ còn `/v2/login` gọi.
 *
 * Middleware (`src/middleware.ts`) CỐ TÌNH giữ bản đồ riêng: nó chạy ở edge và phải độc lập phụ
 * thuộc. Sửa vai trò ở đây thì kiểm tra `v2RoleHome` bên đó luôn.
 */

/** Vai trò nền tảng (users.role). MANAGER/OWNER là vai trò hạng nhất từ V235. */
export type AppRole = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'OWNER' | 'ADMIN'

/**
 * Claim `orgRole` cho thấy người dùng đang ĐIỀU HÀNH một trung tâm.
 * 'ADMIN' là bí danh legacy của MANAGER trên token phát trước V225 — vẫn phải nhận cho tới khi
 * token đó hết hạn.
 */
export function leadsOrg(orgRole?: string | null): boolean {
  const role = String(orgRole ?? '').trim().toUpperCase()
  return role === 'OWNER' || role === 'MANAGER' || role === 'ADMIN'
}

export interface HomeOptions {
  /** Claim `orgRole` từ phản hồi đăng nhập — bắt được cohort legacy role=TEACHER + orgRole=MANAGER. */
  orgRole?: string | null
}

/**
 * Trang chủ của một vai trò sau khi đăng nhập thành công. Mọi đích đều nằm trên bề mặt /v2:
 * nhánh `native` (trả `/dashboard`, `/teacher`, `/org`, `/admin` cho vỏ Expo) đã bị gỡ cùng Đợt 3
 * — nó chỉ được `/login` v1 truyền vào, và `isNative()` luôn false trong bản dựng web.
 *
 * Lưu ý `/v2/admin/users` (không phải `/v2/admin`): admin chưa có trang index, danh sách người dùng
 * là điểm hạ cánh chuẩn — giống `v2RoleHome` trong middleware.
 */
export function homeFor(role: string, options: HomeOptions = {}): string {
  const { orgRole } = options
  const platformRole = String(role ?? '').trim().toUpperCase()

  if (platformRole === 'ADMIN') return '/v2/admin/users'

  // Chủ (OWNER) và quản lý (MANAGER) trung tâm — vai trò hạng nhất từ V235 — vào thẳng console.
  if (platformRole === 'OWNER' || platformRole === 'MANAGER') return '/v2/org'

  if (platformRole === 'TEACHER') {
    // Token legacy: giáo viên nhưng thực chất đang điều hành trung tâm → vẫn là console.
    if (leadsOrg(orgRole)) return '/v2/org'
    return '/v2/teacher'
  }

  return '/v2/student/dashboard'
}
