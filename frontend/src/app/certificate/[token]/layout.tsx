import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * QLT-20 (09/11/2026): token nằm trong path của trang này. `<meta name="referrer" content="no-referrer">`
 * để link bấm ra ngoài (và tài nguyên tải từ trang) không mang URL có token theo trong header Referer.
 * Đặt ở layout để mọi nhánh `generateMetadata` của trang (còn hiệu lực, thu hồi, không tìm thấy) đều có.
 */
export const metadata: Metadata = { referrer: 'no-referrer' }

export default function TokenPageLayout({ children }: { children: ReactNode }) {
  return children
}
