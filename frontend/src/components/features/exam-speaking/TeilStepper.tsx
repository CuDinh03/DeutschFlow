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

/** Thanh tiến trình các Teil: đã xong ✓ · đang làm (đậm) · sắp tới / ngoài phiên (mờ). */
export function TeilStepper({ parts, currentTeil, state, mode }: Props) {
  const finished = state === 'DONE' || state === 'GRADING' || state === 'RESULTS'
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Teile" data-testid="teil-stepper">
      {parts.map((p) => {
        const inSession = mode === 'MOCK' || p.teilNo === currentTeil
        const done = inSession && (finished || p.teilNo < currentTeil)
        const active = !finished && p.teilNo === currentTeil
        return (
          <li
            key={p.teilNo}
            className={`ga-ui inline-flex items-center gap-1.5 rounded-ga border px-2.5 py-1 text-[12.5px] ${
              active
                ? 'border-ga-ink bg-ga-ink text-ga-bg'
                : done
                  ? 'border-ga-green bg-ga-green-soft text-ga-green'
                  : 'border-ga-line bg-ga-card text-ga-muted'
            }`}
            aria-current={active ? 'step' : undefined}
          >
            {done ? <Check size={12} aria-hidden /> : <span className="font-semibold">{p.teilNo}</span>}
            <span className="hidden sm:inline">{p.title}</span>
          </li>
        )
      })}
    </ol>
  )
}
