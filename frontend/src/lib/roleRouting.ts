/**
 * roleRouting — trang chủ sau đăng nhập, theo vai trò. NGUỒN SỰ THẬT DUY NHẤT cho cả hai trang
 * login (`/login` legacy và `/v2/login`).
 *
 * Vì sao tồn tại: mỗi trang login từng tự giữ một bản đồ riêng. Bản của `/v2/login` biết
 * OWNER/MANAGER, bản của `/login` thì KHÔNG — nên quản lý trung tâm đăng nhập ở `/login` rơi vào
 * nhánh mặc định và hạ cánh xuống dashboard HỌC VIÊN, chỉ được middleware đá ngược về `/v2/org`.
 * Một bản đồ, hai trang gọi chung, hết drift.
 *
 * Middleware (`src/middleware.ts`) CỐ TÌNH giữ bản đồ riêng: nó chạy ở edge, phải độc lập phụ
 * thuộc, và home legacy của nó khác (`/student`, không phải `/dashboard`). Sửa vai trò ở đây thì
 * kiểm tra `v2RoleHome`/`roleHome` bên đó luôn.
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
  /** Vỏ Expo/native: không bao giờ vào bề mặt /v2 (desktop-first) → dùng route legacy. */
  native?: boolean
}

/**
 * Trang chủ của một vai trò sau khi đăng nhập thành công.
 *
 * Lưu ý `/v2/admin/users` (không phải `/v2/admin`): admin chưa có trang index, danh sách người dùng
 * là điểm hạ cánh chuẩn — giống `v2RoleHome` trong middleware.
 */
export function homeFor(role: string, options: HomeOptions = {}): string {
  const { orgRole, native = false } = options
  const v2 = !native
  const platformRole = String(role ?? '').trim().toUpperCase()

  if (platformRole === 'ADMIN') return v2 ? '/v2/admin/users' : '/admin'

  // Chủ (OWNER) và quản lý (MANAGER) trung tâm — vai trò hạng nhất từ V235 — vào thẳng console.
  if (platformRole === 'OWNER' || platformRole === 'MANAGER') return v2 ? '/v2/org' : '/org'

  if (platformRole === 'TEACHER') {
    // Token legacy: giáo viên nhưng thực chất đang điều hành trung tâm → vẫn là console.
    if (leadsOrg(orgRole)) return v2 ? '/v2/org' : '/org'
    return v2 ? '/v2/teacher' : '/teacher'
  }

  return v2 ? '/v2/student/dashboard' : '/dashboard'
}
