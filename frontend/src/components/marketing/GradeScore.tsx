/**
 * Khối điểm AI chấm (thang 100) dùng chung cho `/free-grade` (kết quả ngay) và `/report/[token]` (báo cáo
 * chia sẻ). Nâng cấp v3.4: thẻ bo tròn, số lớn font hiển thị kèm thanh mức điểm `.ga-bar-grow`.
 */
export function gradeTone(score: number): 'green' | 'navy' | 'orange' {
  if (score >= 80) return 'green'
  if (score >= 60) return 'navy'
  return 'orange'
}

const BAR = { green: 'bg-ga-green', navy: 'bg-ga-navy', orange: 'bg-ga-orange' } as const

export function GradeScore({ score, topic, center = false }: { score: number; topic?: string | null; center?: boolean }) {
  const pct = Math.min(100, Math.max(8, Math.round(score)))
  const tone = gradeTone(score)
  return (
    <div className={`relative overflow-hidden rounded-t-ga-lg border border-ga-border-strong bg-ga-card p-6 sm:p-7 ${center ? 'text-center' : ''}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${BAR[tone]}`} data-tone={tone} />
      <p className="text-ga-eyebrow uppercase text-ga-muted">Điểm AI chấm</p>
      <p className="mt-2 font-ga-display text-ga-numeral-xl text-ga-ink">
        {score}
        <span className="text-ga-h2 text-ga-muted"> / 100</span>
      </p>
      <div aria-hidden className={`mt-3.5 h-2 overflow-hidden rounded-ga-pill bg-ga-surface-3 ${center ? 'mx-auto max-w-xs' : ''}`}>
        <div className={`ga-bar-grow h-full rounded-ga-pill ${BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {topic && <p className="mt-3 text-ga-small text-ga-muted">Chủ đề: {topic}</p>}
    </div>
  )
}
