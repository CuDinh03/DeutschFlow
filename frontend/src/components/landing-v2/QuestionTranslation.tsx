import { questionTranslation, type QuestionText } from '@/lib/occupationTypes'

/** Bản dịch dưới câu hỏi tiếng Đức (K4 A+B+E): theo ngôn ngữ trang, trang /de/ và câu chưa dịch không hiện gì. */
export function QuestionTranslation({ q, locale, className = '' }: { q: QuestionText; locale: string; className?: string }) {
  const text = questionTranslation(q, locale)
  if (!text) return null
  return (
    <p lang={locale} className={`block text-ga-muted ${className}`}>
      {text}
    </p>
  )
}
