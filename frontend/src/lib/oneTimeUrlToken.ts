'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Token một lần đến từ link email (`?token=`) — QLT-20, kế hoạch A1 09/11/2026.
 *
 * Ngay khi trang mount: đọc token vào state, cất vào sessionStorage (để tải lại trang vẫn chạy tiếp), rồi
 * `history.replaceState` xoá nó khỏi thanh địa chỉ + lịch sử — KHÔNG đợi xử lý thành công. Trước đây token
 * chỉ biến mất khi `router.replace` lúc thành công, nên ca lỗi/bỏ dở để token nằm lại trong lịch sử, và
 * pageview/autocapture gửi PostHog nguyên URL đó.
 *
 * Token đọc từ `window.location` một lần, KHÔNG từ `useSearchParams` — sau `replaceState` router đồng bộ
 * lại search params (không còn token), đọc từ đó là mất token giữa chừng.
 *
 * `token`: `null` = chưa đọc (trước effect đầu, kể cả lúc prerender); `''` = không có token.
 * Gọi `forget()` khi token đã dùng xong hoặc chắc chắn chết (đã dùng/hết hạn) để sessionStorage không giữ nó.
 */
export function useOneTimeUrlToken(storageKey: string, param = 'token'): { token: string | null; forget: () => void } {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(takeOneTimeUrlToken(storageKey, param))
  }, [storageKey, param])

  const forget = useCallback(() => {
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch {
      // sessionStorage bị chặn (chế độ riêng tư) — không có gì để xoá
    }
  }, [storageKey])

  return { token, forget }
}

/** Phần không phụ thuộc React của {@link useOneTimeUrlToken} — đọc, cất, xoá khỏi URL. */
export function takeOneTimeUrlToken(storageKey: string, param = 'token'): string {
  const url = new URL(window.location.href)
  const fromUrl = (url.searchParams.get(param) ?? '').trim()
  if (url.searchParams.has(param)) {
    url.searchParams.delete(param)
    // Giữ `history.state` của Next (cây router) — chỉ đổi URL.
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }
  try {
    if (fromUrl) {
      window.sessionStorage.setItem(storageKey, fromUrl)
      return fromUrl
    }
    return window.sessionStorage.getItem(storageKey) ?? ''
  } catch {
    return fromUrl
  }
}
