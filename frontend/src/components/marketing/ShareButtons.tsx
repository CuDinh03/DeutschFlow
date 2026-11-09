'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2/GaBtn'

/**
 * Nút chia sẻ báo cáo (vòng lặp PLG D6). "Chia sẻ qua Zalo" dùng Web Share API — trên mobile mở
 * khay chia sẻ gồm Zalo; nếu không hỗ trợ thì copy link để dán vào Zalo. Kèm nút Copy link riêng.
 * Galerie (icon đợt B, 09/11/2026): dùng `GaBtn`, phải nằm trong `.ga-scope` (`/free-grade`, `/report`).
 */
export function ShareButtons({ url, score }: { url: string; score: number }) {
  const [copied, setCopied] = useState(false)

  // URL tương đối (vd "/report/xxx/") → tuyệt đối tại thời điểm click (tránh lệch SSR/hydration).
  function absolute(): string {
    if (typeof window !== 'undefined' && url.startsWith('/')) return window.location.origin + url
    return url
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absolute())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard chặn → người dùng tự copy từ thanh địa chỉ */
    }
  }

  async function share() {
    const shareData = {
      title: 'Kết quả chấm bài tiếng Đức',
      text: `Bài viết tiếng Đức của tôi được ${score}/100 — Chấm bởi DeutschFlow`,
      url: absolute(),
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        /* người dùng huỷ hoặc lỗi → rơi xuống copy */
      }
    }
    void copy()
  }

  return (
    <div className="flex flex-wrap gap-3">
      <GaBtn type="button" variant="ink" onClick={share}>
        <Share2 size={16} aria-hidden /> Chia sẻ qua Zalo
      </GaBtn>
      <GaBtn type="button" variant="ghost" onClick={copy} aria-live="polite">
        {copied ? <><Check size={16} aria-hidden /> Đã copy link</> : <><Copy size={16} aria-hidden /> Copy link</>}
      </GaBtn>
    </div>
  )
}
