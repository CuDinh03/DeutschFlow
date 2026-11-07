'use client'

import { Check } from 'lucide-react'
import type { BlueprintPartSummary } from '@/types/exam-speaking'

interface Props {
  parts: BlueprintPartSummary[]
  currentTeil: number
  state: string
  /** DRILL chỉ luyện một Teil — các Teil khác là "không thuộc phiên", không phải "đã xong". */
  mode: 'DRILL' | 'MOCK'
}

/**
 * Hàng Teil của phòng thi nói (mẫu 07/11/2026): viên tròn — đã xong nền nhạt + dấu tích xanh,
 * đang làm nền mực, sắp tới / ngoài phiên viền mảnh chữ mờ. Màn hẹp chỉ hiện số Teil.
 */
export function TeilStepper({ parts, currentTeil, state, mode }: Props) {
  const finished = state === 'DONE' || state === 'GRADING' || state === 'RESULTS'
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Teile" data-testid="teil-stepper">
      {parts.map((p) => {
        const inSession = mode === 'MOCK' || p.teilNo === currentTeil
        const done = inSession && (finished || p.teilNo < currentTeil)
        const active = !finished && p.teilNo === currentTeil
        return (
          <li
            key={p.teilNo}
            className={`ga-ui inline-flex items-center gap-1.5 rounded-ga-pill border px-2.5 py-1 text-ga-small ${
              active
                ? 'border-ga-ink bg-ga-ink text-ga-bg'
                : done
                  ? 'border-transparent bg-ga-side-active text-ga-muted'
                  : 'border-ga-line text-ga-muted'
            }`}
            aria-current={active ? 'step' : undefined}
          >
            {done && <Check size={14} className="text-ga-green" aria-hidden />}
            <span className="font-semibold tabular-nums">{p.teilNo}</span>
            <span className="hidden max-w-[16ch] truncate md:inline">{p.title}</span>
          </li>
        )
      })}
    </ol>
  )
}
