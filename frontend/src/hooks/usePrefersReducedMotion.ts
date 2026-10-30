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
 * Người dùng có bật "giảm chuyển động" không. Dành cho trang công khai: `useReducedMotion` của Framer
 * Motion kéo cả thư viện vào bundle trang chủ, nơi hiện chưa có file nào dùng nó (hệ thiết kế §7).
 * Server luôn trả `false`, nên HTML ban đầu phải là trạng thái nghỉ, đọc được mà không cần JS.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
