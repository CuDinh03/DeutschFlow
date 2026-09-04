import * as React from 'react'
// Import THẲNG từ file component, không qua barrel `@/components/ui-v2` — cùng lý do với
// routeErrorShared: màn chờ phải là chunk nhẹ nhất có thể, nó chạy TRƯỚC khi trang thật tải xong.
import { SkeletonRow } from '@/components/ui-v2/SkeletonRow'

/**
 * Ruột chung của các `loading.tsx` trong /v2 (`/v2/student/loading.tsx`, `/v2/teacher/…`, …).
 *
 * Vì sao tồn tại: toàn bộ /v2 là SSR dynamic (ƒ) — mỗi điều hướng phải chờ Lambda render xong mới
 * có phản hồi, người dùng nhìn trang cũ "đứng hình" 0,5–3s. `loading.tsx` cho Next một khung để
 * vẽ NGAY khi bấm link, trong lúc RSC payload còn đang bay.
 *
 * Boundary này nằm DƯỚI `layout.tsx` của từng khu nên nó render bên trong `<main>` của GaShell —
 * sidebar và thanh trên đứng yên, chỉ vùng nội dung nhấp nháy skeleton. Khung mô phỏng nhịp chung
 * của mọi trang v2: tiêu đề + dải hành động, rồi lưới thẻ. Không mô phỏng sâu hơn từng trang —
 * skeleton càng đặc thù càng "giật" khi nội dung thật khác nó.
 */
export function RouteLoadingSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {/* Nhại GaPageHdr: một thanh tiêu đề + một nút hành động bên phải */}
      <div aria-hidden className="mb-6 flex items-center justify-between gap-4 lg:mb-8">
        <div className="space-y-2.5">
          <div className="h-6 w-44 animate-pulse rounded-ga bg-ga-border lg:h-7 lg:w-56" />
          <div className="h-2.5 w-64 animate-pulse rounded-ga bg-ga-side-active" />
        </div>
        <div className="h-9 w-24 shrink-0 animate-pulse rounded-ga-pill bg-ga-side-active" />
      </div>
      {/* Lưới thẻ nội dung */}
      <div aria-hidden className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-5">
        <SkeletonRow variant="card" />
        <SkeletonRow variant="card" />
        <SkeletonRow variant="card" className="hidden xl:block" />
      </div>
      {/* Vài dòng danh sách phía dưới */}
      <div aria-hidden className="mt-6 lg:mt-8">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow className="border-b-0" />
      </div>
    </div>
  )
}
