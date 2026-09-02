'use client'

import { useEffect, useState } from 'react'

import api from '@/lib/api'

/**
 * Số thẻ đến hạn ôn hôm nay — nguồn cho việc chính ở hub Từ vựng.
 *
 * <p>Hook cũ `@/hooks/useReviewDueCount` đã bị đợt dọn cây v1 (#443) xoá vì lúc đó chỉ v1 dùng. Endpoint
 * `GET /api/srs/count` vẫn còn, nên phần logic ở lại đây — cạnh chính màn hình cần nó — thay vì hồi sinh
 * một file thuộc cây đã gỡ.
 *
 * <p>Không polling: đây là màn tra cứu, một lần đọc lúc mở màn là đủ. Lỗi mạng trả 0 chứ không ném —
 * việc chính khi đó rơi về nhánh "học từ mới", vốn luôn là một lời mời hợp lệ.
 */
export function useDueCount(): number {
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ dueCount?: number }>('/srs/count')
      .then((res) => {
        if (cancelled) return
        const n = res.data?.dueCount
        setDueCount(typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0)
      })
      .catch(() => {
        if (!cancelled) setDueCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return dueCount
}
