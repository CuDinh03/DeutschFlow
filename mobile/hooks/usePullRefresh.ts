import { useCallback, useState } from 'react'

/**
 * Spinner kéo-để-làm-mới CHỈ theo thao tác kéo của người dùng.
 *
 * Trói `refreshing` vào `query.isRefetching` làm RefreshControl tự bật ngay lúc màn mount khi
 * cache vừa bị invalidate (vd. về màn bài giao sau buổi nói: smoke N2 05/09) — iOS để lại một
 * khoảng trống trên đầu ScrollView tới khi người dùng cuộn. Spinner ở đây chỉ sống trong lúc
 * `refetch` do chính cú kéo gọi.
 */
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } catch {
      // Lỗi đã nằm trong state của query — màn tự hiện ErrorState/Thử lại.
    } finally {
      setRefreshing(false)
    }
  }, [refetch])
  return { refreshing, onRefresh }
}
