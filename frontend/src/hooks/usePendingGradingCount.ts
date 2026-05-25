import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'

// ─── Module-level cache ───────────────────────────────────────────────────────
// Chia sẻ giữa tất cả instances của hook — tránh gọi API trùng lặp khi
// nhiều trang mount cùng lúc hoặc navigate nhanh.
let cachedCount = 0
let lastFetchedAt = 0
const CACHE_TTL_MS = 30_000 // 30 giây

// Danh sách subscribers để broadcast khi count thay đổi
const subscribers = new Set<(count: number) => void>()

function notifyAll(count: number) {
  cachedCount = count
  subscribers.forEach(fn => fn(count))
}

async function fetchCount() {
  try {
    const res = await api.get('/v2/teacher/grading/stats')
    const count = res.data?.totalPending ?? 0
    lastFetchedAt = Date.now()
    notifyAll(count)
  } catch {
    // Nếu grading/stats fail (ví dụ endpoint chưa deploy), fallback nhẹ
    try {
      const res = await api.get('/v2/teacher/dashboard/summary')
      const count = res.data?.pendingReviewCount ?? 0
      lastFetchedAt = Date.now()
      notifyAll(count)
    } catch {
      // Giữ nguyên giá trị cũ, không reset về 0
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Hook lấy số bài chờ chấm của giáo viên hiện tại.
 *
 * - Dùng module-level cache: nhiều trang mount cùng lúc chỉ gọi 1 request.
 * - Cache TTL 30 giây: navigate qua lại không gọi lại API.
 * - Tự động refresh khi gọi `refresh()` (ví dụ sau khi chấm xong 1 bài).
 * - Cleanup đúng cách: không setState sau khi unmount.
 */
export function usePendingGradingCount() {
  const [count, setCount] = useState(cachedCount)

  useEffect(() => {
    let mounted = true

    // Subscribe để nhận broadcast khi count thay đổi từ bất kỳ instance nào
    const handler = (newCount: number) => {
      if (mounted) setCount(newCount)
    }
    subscribers.add(handler)

    // Fetch nếu cache đã hết hạn hoặc chưa có data
    const isStale = Date.now() - lastFetchedAt > CACHE_TTL_MS
    if (isStale) {
      fetchCount()
    } else {
      // Dùng ngay giá trị cache
      if (mounted) setCount(cachedCount)
    }

    return () => {
      mounted = false
      subscribers.delete(handler)
    }
  }, [])

  // Expose refresh để gọi thủ công sau khi chấm bài
  const refresh = useCallback(() => {
    lastFetchedAt = 0 // invalidate cache
    fetchCount()
  }, [])

  return { count, refresh }
}
