'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

/**
 * Nút chia sẻ báo cáo (vòng lặp PLG D6). "Chia sẻ qua Zalo" dùng Web Share API — trên mobile mở
 * khay chia sẻ gồm Zalo; nếu không hỗ trợ thì copy link để dán vào Zalo. Kèm nút Copy link riêng.
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
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0068FF] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110"
      >
        <Share2 size={16} /> Chia sẻ qua Zalo
      </button>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
      >
        {copied ? <><Check size={16} className="text-emerald-500" /> Đã copy link</> : <><Copy size={16} /> Copy link</>}
      </button>
    </div>
  )
}
