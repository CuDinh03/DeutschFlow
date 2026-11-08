'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Clip luyện thi 24 giây (A5, kế hoạch cải thiện trang chủ 08/11/2026) — quay màn hình thật:
 * luyện Lesen có đồng hồ → chọn đáp án → xem lại câu sai → AI chấm bài Viết. Cắt từ video 58 giây
 * 4:5 (`plans/2026-11-07-video-luyen-thi`), H.264 720×900 không tiếng, poster WebP (repo bỏ qua *.jpg), tự lưu ở `public/video/`
 * (owner chốt: không nhúng YouTube).
 *
 * - `preload="none"` + poster: không tải video trước khi cần, không ảnh hưởng LCP.
 * - Chỉ tự chạy khi ≥50% khung nằm trong màn hình, ra khỏi màn thì dừng.
 * - Giảm chuyển động: KHÔNG tự chạy, chỉ hiện poster; người xem bấm nút mới phát.
 * - Chạy quá 5 giây nên phải có nút dừng (WCAG 2.2.2). Người xem đã bấm dừng thì cuộn lại không tự chạy.
 */
export interface ExamClipProps {
  caption: string
  /** Mô tả nội dung video cho trình đọc màn hình (video không tiếng, chữ nằm trong hình). */
  label: string
  playLabel: string
  pauseLabel: string
  accent: string
}

export const EXAM_CLIP_SRC = '/video/luyen-thi-clip.mp4'
export const EXAM_CLIP_POSTER = '/video/luyen-thi-clip-poster.webp'

export function ExamClip({ caption, label, playLabel, pauseLabel, accent }: ExamClipProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const reduced = usePrefersReducedMotion()
  const [playing, setPlaying] = React.useState(false)
  const userPaused = React.useRef(false)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || reduced || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused.current) void video.play().catch(() => {})
        else if (!entry.isIntersecting) video.pause()
      },
      { threshold: 0.5 },
    )
    io.observe(video)
    return () => io.disconnect()
  }, [reduced])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      userPaused.current = false
      void video.play().catch(() => {})
    } else {
      userPaused.current = true
      video.pause()
    }
  }

  return (
    <figure className="m-0 min-w-0 border border-ga-border bg-ga-card">
      <div className="h-[3px]" style={{ background: accent }} />
      <figcaption className="flex items-center gap-2.5 border-b border-ga-border px-4 py-3 sm:px-5">
        <span className="inline-block h-[7px] w-[7px] shrink-0" style={{ background: accent }} />
        <GaCap>{caption}</GaCap>
      </figcaption>
      <div className="relative aspect-[4/5] bg-ga-bg">
        <video
          ref={videoRef}
          className="block h-full w-full"
          src={EXAM_CLIP_SRC}
          poster={EXAM_CLIP_POSTER}
          aria-label={label}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? pauseLabel : playLabel}
          className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center bg-ga-ink text-ga-bg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-ink"
        >
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
      </div>
    </figure>
  )
}
