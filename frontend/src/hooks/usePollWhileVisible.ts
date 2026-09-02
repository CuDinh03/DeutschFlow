'use client'

import { useEffect } from 'react'

/**
 * Poll theo nhịp `intervalMs` nhưng CHỈ khi tab đang hiển thị (W5 audit lag 02/09).
 *
 * Trước đây các màn tin nhắn `setInterval` trần: tab bị ẩn/quên vẫn bắn request mỗi 5–12s
 * vô hạn — một học viên mở 3 tab là backend nhận gấp ba tải poll từ những màn không ai nhìn.
 * Mẫu này chép từ useAdminData (đã chạy ổn ở khu admin): ẩn tab → dừng timer; quay lại tab →
 * poll bù NGAY một nhịp rồi chạy tiếp — người dùng không phải chờ trọn một chu kỳ để thấy
 * tin mới sau khi quay lại.
 *
 * `poll` phải là callback ổn định (useCallback) — đổi identity là timer bị dựng lại.
 * Hook KHÔNG gọi poll cho lần tải đầu: màn nào cũng đã có effect load-lần-đầu riêng (spinner).
 */
export function usePollWhileVisible(poll: () => void | Promise<void>, intervalMs: number): void {
  useEffect(() => {
    let timerId: number | null = null

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearInterval(timerId)
        timerId = null
      }
    }

    const startTimerIfVisible = () => {
      clearTimer()
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      timerId = window.setInterval(() => {
        // Guard kép: một số browser throttle chứ không dừng interval của tab ẩn.
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void poll()
        }
      }, intervalMs)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer()
        return
      }
      startTimerIfVisible()
      void poll()
    }

    startTimerIfVisible()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [poll, intervalMs])
}
