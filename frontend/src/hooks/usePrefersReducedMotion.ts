'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * Người dùng có bật "giảm chuyển động" không. Hook nhẹ cho các hiệu ứng CSS/WAAPI ở trang công khai.
 * Thành phần dùng Framer (`m` trong `LazyMotion`) thì `MotionConfig reducedMotion="user"` ở layout gốc
 * đã lo phần này.
 * Server luôn trả `false`, nên HTML ban đầu phải là trạng thái nghỉ, đọc được mà không cần JS.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
