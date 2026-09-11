import type { PublicReportIssue } from '@/lib/reportIssueApi'

/**
 * Đọc phiếu công khai từ backend cho trang `/phieu/[token]` (server-side).
 *
 * Để RIÊNG khỏi `page.tsx` chứ không phải cho gọn: Next kiểm kiểu tệp route lúc build và một `page.tsx`
 * chỉ được xuất `default` cùng vài tên đã biết (`generateMetadata`, `revalidate`, …). Thêm một hàm xuất
 * khẩu nữa — dù chỉ để test gọi tới — là `next build` đỏ với "does not match the required types", mà
 * `tsc --noEmit` cục bộ KHÔNG bắt được (bộ kiểm đó nằm trong `.next/types`, chỉ sinh ra sau khi build).
 *
 * `cache: 'no-store'`: mỗi lượt mở phải chạm máy chủ thật, vì chính lượt gọi đó là thứ tăng `view_count`
 * và ghi vết `report.viewed` cho sổ của trung tâm — một bản cache là một lượt xem bị nuốt.
 *
 * Mọi thất bại (404, 410, 503, mất mạng) đều thành `null` ⇒ trang gọi `notFound()`. Không phân biệt,
 * không thông điệp riêng: token sai và token đã thu hồi phải nhìn giống hệt nhau, nếu không trang trở
 * thành máy dò token.
 */
const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

export async function fetchPublicReportIssue(token: string): Promise<PublicReportIssue | null> {
  try {
    const res = await fetch(`${backendOrigin}/api/public/report-issues/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as PublicReportIssue
  } catch {
    return null
  }
}
