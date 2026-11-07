'use client'

import type { ReactNode } from 'react'
import { LazyMotion } from 'framer-motion'

const loadFeatures = () => import('./motionFeatures').then((m) => m.default)

/**
 * Bọc phần trang công khai có dùng Framer (hệ thiết kế §7, bỏ luật cấm 08/11/2026). `strict` bắt mọi
 * `motion.*` đầy đủ lọt vào; bên trong chỉ dùng `m.*`. Bộ tính năng tải sau khi trang đã vẽ, nên
 * trước lúc đó `m.*` hiện đúng trạng thái tĩnh và không chặn LCP.
 * Giảm chuyển động đã có `MotionConfig reducedMotion="user"` ở layout gốc lo.
 */
export function LandingMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
