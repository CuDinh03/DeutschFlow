'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * InterviewPhaseBar — tiến độ buổi phỏng vấn (S-06).
 *
 * Brief vẽ "Câu hỏi 3/8". **Không làm được, và không được giả vờ làm được.** Backend không có
 * tổng số câu: `InterviewTurn` chỉ mang `turnIndex` + `phase`, còn bộ pha là danh sách CỐ ĐỊNH
 * năm chặng (`InterviewAnalyticsQueryService.PHASE_ORDER`). In "3/8" là bịa một mẫu số không tồn
 * tại — đúng loại nói dối trạng thái mà S-14 cấm. Nên tiến độ ở đây là theo PHA, và pha thì có thật.
 *
 * Dải này KHÔNG phải một shell: Room hiện do `SpeakingChatExperience` sở hữu và S-07/B-16 sẽ tái
 * cấu trúc cả họ component đó. Dựng thêm một mode shell bọc ngoài lúc này chỉ tạo hai header
 * chồng nhau rồi B-16 lại gỡ.
 */

/** Thứ tự pha của backend. Lệch danh sách này là lệch cả tiến độ. */
export const INTERVIEW_PHASES = ['INTRO', 'ICE_BREAKER', 'HARD_SKILLS', 'STAR_SOFT', 'CLOSING'] as const
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number]

/** Vị trí của một pha; `-1` khi backend gửi pha lạ — đừng đoán, hãy nói "chưa bắt đầu". */
export function phaseIndex(phase: string | null | undefined): number {
  if (!phase) return -1
  return INTERVIEW_PHASES.indexOf(phase.toUpperCase() as InterviewPhase)
}

export function InterviewPhaseBar({ phase, className }: { phase?: string | null; className?: string }) {
  const t = useTranslations('v2.student.interviewShell')
  const current = phaseIndex(phase)

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ga-line bg-ga-card px-4 py-2 lg:px-6',
        className,
      )}
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1.5" aria-label={t('phaseProgressLabel')}>
        {INTERVIEW_PHASES.map((p, i) => {
          const done = current > i
          const active = current === i
          return (
            <li key={p} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                aria-hidden
                className={cn(
                  'h-1.5 rounded-ga-pill',
                  active ? 'bg-ga-accent' : done ? 'bg-ga-muted' : 'bg-ga-surface',
                )}
              />
              {/* Chỉ pha đang mở mới in nhãn chữ: năm nhãn cùng lúc ở 390px là không đọc nổi. Các
                  pha còn lại vẫn có nhãn cho screen reader — trạng thái không được truyền chỉ bằng màu. */}
              <span className={cn('ga-ui truncate text-ga-caption', active ? 'font-semibold text-ga-ink' : 'sr-only')}>
                {t(`phases.${p}`)}
              </span>
            </li>
          )
        })}
      </ol>

      <p className="ga-ui shrink-0 tabular-nums text-ga-caption text-ga-muted" role="status">
        {current >= 0 ? t('phaseOf', { index: current + 1, total: INTERVIEW_PHASES.length }) : t('notStarted')}
      </p>
    </div>
  )
}
