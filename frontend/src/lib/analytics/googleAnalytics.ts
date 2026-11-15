/**
 * Google Analytics 4 cho TRANG CÔNG KHAI (owner chốt 15/11/2026).
 *
 * Mục đích: đo lượt truy cập từ Google/SEO vào các trang bán hàng + luyện thi. Phần trong app (`/v2`),
 * thanh toán và các trang chia sẻ có token (`/phieu|report|certificate/<token>`) KHÔNG gửi gì cho Google —
 * hành vi học viên đã có PostHog đo, và không đẩy dữ liệu người dùng sang bên thứ ba khi không cần.
 *
 * Chọn DANH SÁCH CHO PHÉP (không phải danh sách chặn): trang mới thêm sau này mặc định KHÔNG bị đo, nên
 * một trang có dữ liệu riêng tư không thể lọt sang Google chỉ vì quên cập nhật danh sách.
 */

/** Mã đo lường của luồng web mydeutschflow.com (không phải bí mật — nằm sẵn trong HTML của mọi site dùng GA). */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-JB5P4G4FXV'

/** Chỉ đo trên tên miền thật — máy dev, bản xem trước, staging không làm bẩn số liệu. */
const GA_HOSTNAMES: ReadonlySet<string> = new Set(['mydeutschflow.com', 'www.mydeutschflow.com'])

/** Trang công khai được đo (chính trang đó và mọi trang con). Trang chủ `/` xử lý riêng. */
const GA_PUBLIC_PREFIXES = [
  '/about',
  '/cam-nang',
  '/chi-phi',
  '/free-grade',
  '/giao-vien-mien-phi',
  '/hoc-nghe',
  '/luyen-thi',
  '/mydeutschflow-la-gi',
  '/phong-van',
  '/privacy',
  '/support',
  '/teachers',
  '/terms',
  '/trung-tam',
] as const

export function isGaHost(hostname: string): boolean {
  return GA_HOSTNAMES.has(hostname.toLowerCase())
}

export function isGaTrackedPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true
  const p = pathname.toLowerCase()
  return GA_PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}
