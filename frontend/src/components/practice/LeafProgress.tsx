'use client'

import '@/styles/practice-runner.css'

/**
 * Thanh tiến độ của runner: mỗi câu là một chiếc lá nhỏ, tô dần theo câu đã trả lời — thay cho bar
 * xám. Dưới 60px ngang nên lá chỉ là silhouette + gân chính (scale-test 24px của Lernbaum v2).
 */
export function LeafProgress({
  total,
  answered,
  accent,
  label,
}: {
  total: number
  answered: number
  accent: string
  label: string
}) {
  if (total <= 0) return null
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      data-testid="leaf-progress"
      className="flex items-end gap-1"
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < answered
        return (
          <svg key={i} viewBox="-9 -29 18 30" width="14" height="23" aria-hidden className="overflow-visible">
            <g className={filled ? 'pr-leaf-filled' : undefined} data-leaf-filled={filled}>
              <path
                d="M0 0 C -2.5 -3, -6 -7.5, -6.5 -13 C -6.8 -18.5, -3.5 -24, 0.6 -27 C 4.5 -23.5, 6.6 -18, 6 -12.5 C 5.4 -7.5, 2.5 -3, 0 0 Z"
                fill={filled ? accent : 'transparent'}
                stroke={filled ? '#3A302A' : 'var(--ga-line)'}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M0 -1.5 C 0.3 -8, 0.1 -15, 0.5 -24" fill="none" stroke={filled ? '#3A302A' : 'var(--ga-line)'} strokeWidth="1" opacity="0.6" strokeLinecap="round" />
            </g>
          </svg>
        )
      })}
    </div>
  )
}
