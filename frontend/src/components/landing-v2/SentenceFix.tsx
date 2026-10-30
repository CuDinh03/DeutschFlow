'use client'

import * as React from 'react'
import { GaCap } from '@/components/ui-v2'
import { useInViewOnce } from '@/hooks/useInViewOnce'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Câu được sửa ngay trước mắt, trong báo cáo mẫu ở trang chủ (khối S5). Khi cuộn tới, câu của người
 * học hiện trước, chỗ sai được gạch sóng đỏ, rồi câu nên nói và lý do hiện ra, sau đó dừng hẳn.
 *
 * Trạng thái nghỉ là trạng thái cuối: HTML của server, người tắt JS và người bật giảm chuyển động đều
 * đọc đủ cả ba phần. Chữ đi nguyên từ catalog; `wrong` và `right` chỉ là đoạn cần đánh dấu trong câu.
 * Sổ lời hứa: ví dụ này là ngữ pháp (trật tự từ), không nói gì tới phát âm.
 */

/** Khoảng chờ trước mỗi bước: gạch chỗ sai → hiện câu đúng → hiện lý do → về trạng thái nghỉ. */
const STEP_WAIT_MS = [700, 1000, 900, 500]

function Marked({ text, mark, className }: { text: string; mark: string; className: string }) {
  const at = text.indexOf(mark)
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span className={className}>{mark}</span>
      {text.slice(at + mark.length)}
    </>
  )
}

export function SentenceFix({
  quoteCap,
  quote,
  wrong,
  fixCap,
  fix,
  right,
  why,
}: {
  quoteCap: string
  quote: string
  wrong: string
  fixCap: string
  fix: string
  right: string
  why: string
}) {
  const calm = usePrefersReducedMotion()
  // null = trạng thái nghỉ; 0–3 chỉ có trong lúc chạy.
  const [step, setStep] = React.useState<number | null>(null)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])
  React.useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const ref = useInViewOnce<HTMLDivElement>(() => {
    if (calm) return
    setStep(0)
    let at = 0
    timers.current = STEP_WAIT_MS.map((wait, i) => {
      at += wait
      return setTimeout(() => setStep(i < 3 ? i + 1 : null), at)
    })
  }, 0.6)

  return (
    <div ref={ref} data-fix-step={step ?? undefined} className="mb-4 bg-ga-bg p-4">
      <GaCap className="mb-2 text-ga-subtle">{quoteCap}</GaCap>
      <p lang="de" className="mb-3 font-ga-display text-ga-body-lg italic text-ga-ink">
        <Marked text={quote} mark={wrong} className="ga-fix-wrong" />
      </p>
      <div className="ga-fix-line">
        <GaCap className="mb-2 text-ga-gold">{fixCap}</GaCap>
        <p lang="de" className="mb-1 font-ga-display text-ga-body-lg italic text-ga-ink">
          <Marked text={fix} mark={right} className="ga-fix-right" />
        </p>
      </div>
      <p className="ga-fix-why text-ga-small text-ga-muted">{why}</p>
    </div>
  )
}
