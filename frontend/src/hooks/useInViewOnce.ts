'use client'

import { useEffect, useRef } from 'react'

/**
 * Gọi `onEnter` đúng một lần khi phần tử lọt vào màn hình. Chuyển động của trang công khai chạy một
 * lần rồi dừng (hệ thiết kế §7: quiet, deliberate), nên observer tự ngắt sau lần đầu.
 * Trình duyệt không có IntersectionObserver thì không gọi: trạng thái nghỉ vẫn đầy đủ nội dung.
 */
export function useInViewOnce<T extends Element>(onEnter: () => void, threshold = 0.4) {
  const ref = useRef<T>(null)
  const latest = useRef(onEnter)
  latest.current = onEnter

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        latest.current()
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
