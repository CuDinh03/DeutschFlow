'use client'

import { useEffect, useState } from 'react'

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

/**
 * Theo dõi quyền micro qua Permissions API (N0.7 QS-1):
 * - trả 'denied' NGAY khi vào trang → phòng thi cảnh báo trước khi đồng hồ chạy;
 * - subscribe onchange → người dùng vừa cấp quyền là UI tự hồi phục, không cần reload.
 * Trình duyệt không hỗ trợ query('microphone') (Safari cũ, Firefox một số bản) → 'unknown',
 * mọi UI phải coi 'unknown' như 'prompt' (không chặn gì).
 */
export function useMicPermission(): MicPermissionState {
  const [state, setState] = useState<MicPermissionState>('unknown')

  useEffect(() => {
    let alive = true
    let status: PermissionStatus | null = null
    const onChange = () => {
      if (alive && status) setState(status.state as MicPermissionState)
    }
    ;(async () => {
      try {
        status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        if (!alive) return
        setState(status.state as MicPermissionState)
        status.addEventListener('change', onChange)
      } catch {
        // Permissions API thiếu hoặc không hỗ trợ 'microphone' — giữ 'unknown'.
      }
    })()
    return () => {
      alive = false
      status?.removeEventListener('change', onChange)
    }
  }, [])

  return state
}
