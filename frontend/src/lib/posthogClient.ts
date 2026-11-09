'use client'

import { useEffect, useState } from 'react'
import type { PostHog } from 'posthog-js'
import { isSupportMode } from '@/lib/authSession'

/**
 * Cửa duy nhất tới PostHog trên web (đợt A tốc độ trang chủ, 26/10/2026).
 *
 * Trước: `import posthog from 'posthog-js'` tĩnh ở provider gốc, error boundary và vài hook → thư
 * viện (~62KB nén) nằm trong bundle ĐẦU của mọi trang, kể cả trang chủ, dù `init` đã được hoãn
 * tới lúc rảnh. Nay chỉ có `import()` động trong {@link loadPostHog}: bundle đầu không còn
 * posthog-js, thư viện tải sau khi trang đã vẽ xong.
 *
 * Việc gọi trước lúc thư viện sẵn sàng (pageview đầu, lỗi sớm, CTA bấm nhanh) xếp hàng rồi chạy
 * ngay khi init xong — cùng hành vi posthog-js từng tự làm khi còn import tĩnh. Hàng có trần để
 * máy chặn PostHog (adblock, mạng hỏng) không phình bộ nhớ vô hạn.
 */

type Task = (ph: PostHog) => void

const MAX_QUEUED = 100

let instance: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
const queue: Task[] = []
const readyListeners = new Set<(ph: PostHog) => void>()

/** Chạy `task` với PostHog đã init; chưa sẵn sàng thì xếp hàng (bỏ bớt khi hàng đầy). */
/**
 * Tab đang (hoặc sắp) ở chế độ hỗ trợ chỉ-đọc. Trang `/v2/support-session` tính luôn là hỗ trợ: lúc nó
 * đang đổi mã thì `isSupportMode()` còn false, mà PostHog khởi động lúc tab rảnh (thường đúng lúc chờ
 * redeem) — để lọt là autocapture/ghi phiên chạy suốt trên dữ liệu của người dùng (review PR 805).
 */
function inSupportContext(): boolean {
  if (isSupportMode()) return true
  return typeof window !== 'undefined' && window.location.pathname.includes('/v2/support-session')
}

/**
 * Lưới cuối: tab vừa vào chế độ hỗ trợ mà PostHog lỡ đã chạy → tắt ghi phiên + ngừng capture.
 * Trang phiên hỗ trợ còn tải lại toàn trang (hardReplace) nên instance cũ chết theo.
 */
export function stopPostHogForSupport(): void {
  if (!instance) return
  try {
    instance.stopSessionRecording()
    instance.opt_out_capturing()
  } catch {
    // analytics hỏng không được làm hỏng trang
  }
}

export function withPostHog(task: Task): void {
  // Tab phiên hỗ trợ chỉ-đọc: ADMIN đang xem như người dùng — không identify/capture gì dưới danh tính họ.
  if (inSupportContext()) return
  if (instance) {
    task(instance)
    return
  }
  if (queue.length < MAX_QUEUED) queue.push(task)
}

/** PostHog đã init, hoặc `null` khi chưa tải xong. Dùng cho chỗ chỉ muốn đọc trạng thái. */
export function getPostHog(): PostHog | null {
  return instance
}

/**
 * Tải posthog-js rồi gọi `init` — chỉ chạy một lần dù gọi nhiều lần. Lỗi tải chunk (mạng chập)
 * thì bỏ hàng chờ và cho phép thử lại ở lần gọi sau, không ném ra ngoài: analytics hỏng không
 * được làm hỏng trang.
 */
export function loadPostHog(init: (ph: PostHog) => void): Promise<PostHog | null> {
  // Tab phiên hỗ trợ: KHÔNG init PostHog (không pageview, không ghi phiên, không autocapture).
  if (inSupportContext()) return Promise.resolve(null)
  if (instance) return Promise.resolve(instance)
  if (loading) return loading
  loading = import('posthog-js')
    .then(({ default: ph }) => {
      init(ph)
      instance = ph
      for (const task of queue.splice(0)) task(ph)
      readyListeners.forEach((listener) => listener(ph))
      readyListeners.clear()
      return ph
    })
    .catch((err: unknown) => {
      console.warn('[analytics] posthog-js không tải được', err)
      queue.length = 0
      loading = null
      return null
    })
  return loading
}

/** Hook: PostHog sau khi init (component re-render một lần khi thư viện sẵn sàng). */
export function usePostHogClient(): PostHog | null {
  const [ph, setPh] = useState<PostHog | null>(instance)
  useEffect(() => {
    if (instance) {
      setPh(instance)
      return
    }
    readyListeners.add(setPh)
    return () => {
      readyListeners.delete(setPh)
    }
  }, [])
  return ph
}

/**
 * Thay `useFeatureFlagEnabled` của posthog-js/react (cần `PHProvider`, kéo thư viện vào bundle
 * đầu). Cùng ngữ nghĩa: `undefined` khi cờ chưa nạp, sau đó `true`/`false`.
 */
export function useFeatureFlagEnabled(flag: string): boolean | undefined {
  const ph = usePostHogClient()
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!ph) return
    const read = () => setEnabled(ph.isFeatureEnabled(flag))
    read()
    return ph.onFeatureFlags(read)
  }, [ph, flag])
  return enabled
}

/** Chỉ cho test: đưa module về trạng thái chưa tải. */
export function __resetPostHogClientForTest(): void {
  instance = null
  loading = null
  queue.length = 0
  readyListeners.clear()
}
