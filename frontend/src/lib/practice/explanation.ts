/**
 * Chọn giải-thích-vì-sao-đúng theo locale UI cho bài luyện Practice Node.
 *
 * Hợp đồng dữ liệu (quyết định product 18/08): đề bài 100% tiếng Đức; LLM sinh
 * giải thích ở BA field `explanation_de/_en/_vi`, FE chỉ hiện SAU khi nộp bài.
 * Session sinh trước ngày đổi chỉ có `explanation_vi` — fallback giữ chúng sống.
 */
export interface ExplanationFields {
  explanation_de?: string
  explanation_en?: string
  explanation_vi?: string
}

export function pickExplanation(fields: ExplanationFields, locale: string): string | null {
  const byLocale: Record<string, Array<string | undefined>> = {
    de: [fields.explanation_de, fields.explanation_en, fields.explanation_vi],
    en: [fields.explanation_en, fields.explanation_de, fields.explanation_vi],
    vi: [fields.explanation_vi, fields.explanation_en, fields.explanation_de],
  }
  const order = byLocale[locale] ?? byLocale.vi
  return order.find((v) => typeof v === 'string' && v.trim().length > 0) ?? null
}
