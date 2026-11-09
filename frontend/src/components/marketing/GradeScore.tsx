/**
 * Khối điểm AI chấm (thang 100) dùng chung cho `/free-grade` (kết quả ngay) và `/report/[token]` (báo cáo
 * chia sẻ). Galerie: nền thẻ, số lớn font hiển thị, một vạch màu token theo mức điểm thay cho nền gradient
 * cũ. Phải nằm trong `.ga-scope`.
 */
export function gradeTone(score: number): 'green' | 'navy' | 'orange' {
  if (score >= 80) return 'green'
  if (score >= 60) return 'navy'
  return 'orange'
}

const BAR = { green: 'bg-ga-green', navy: 'bg-ga-navy', orange: 'bg-ga-orange' } as const

export function GradeScore({ score, topic, center = false }: { score: number; topic?: string | null; center?: boolean }) {
  return (
    <div className={`relative border border-ga-border bg-ga-card p-6 sm:p-8 ${center ? 'text-center' : ''}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${BAR[gradeTone(score)]}`} data-tone={gradeTone(score)} />
      <p className="text-ga-eyebrow uppercase text-ga-muted">Điểm AI chấm</p>
      <p className="mt-2 font-ga-display text-ga-display font-medium leading-none text-ga-ink">
        {score}
        <span className="text-ga-h2 text-ga-muted">/100</span>
      </p>
      {topic && <p className="mt-3 text-ga-small text-ga-muted">Chủ đề: {topic}</p>}
    </div>
  )
}
