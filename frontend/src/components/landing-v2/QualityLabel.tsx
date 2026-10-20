/** Nhãn chất lượng của câu hỏi / từ chuyên môn (đợt 2d A+B+E): Đã duyệt · AI tạo · Bộ câu hỏi chung. */
const LABEL_CLASS = {
  approved: 'border-ga-ink text-ga-ink',
  aiGenerated: 'border-ga-yellow bg-ga-yellow-soft text-ga-ink',
  general: 'border-ga-border text-ga-muted',
} as const

export type QualityLabelKind = keyof typeof LABEL_CLASS

export function QualityLabel({ kind, text }: { kind: QualityLabelKind; text: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center border px-2 py-0.5 text-ga-caption ${LABEL_CLASS[kind]}`}>
      {text}
    </span>
  )
}
