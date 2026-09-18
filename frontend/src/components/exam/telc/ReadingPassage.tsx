'use client'

import { useTranslations } from 'next-intl'

/** Những khoá của một bài đọc dài kiểu đề thật — tập con của Teil trong `sections_json`. */
export interface RichPassageTeil {
  context?: string
  title_de?: string
  vorspann_de?: string
  context_lines?: boolean
  glossary?: Array<{ term: string; explanation_de: string }>
}

/** Đề khai Vorspann / số dòng / chú thích thì dựng theo kiểu đề thật; đề Goethe không khai ⇒ nhánh cũ. */
export function isRichPassage(teil: RichPassageTeil): boolean {
  return Boolean(teil.context_lines || teil.vorspann_de?.trim() || (teil.glossary && teil.glossary.length > 0))
}

/** Dòng của thân bài theo đúng cách tác giả ngắt (`\n`); dòng trống là khoảng cách giữa hai đoạn. */
export function passageLines(context: string): string[] {
  return context.replace(/\r\n/g, '\n').split('\n')
}

export const LINE_NUMBER_EVERY = 5

/**
 * Bài đọc dài của Leseverstehen Teil 2 (telc), dựng như trang đề thật: tiêu đề, **Vorspann** in
 * đậm, thân bài có **số dòng mỗi 5 dòng** ở lề trái, chú thích từ khó (*) dưới bài.
 *
 * Vì sao cần: đề thật đánh số dòng để thí sinh định vị nhanh khi câu hỏi không theo thứ tự bài,
 * và có Vorspann + chú thích — ba thứ mà một khối văn bản liền không cho. Số dòng đếm theo dòng
 * TÁC GIẢ ngắt (seed viết mỗi dòng ≈ 10 từ), không theo dòng trình duyệt bẻ, để cùng một số dòng
 * trỏ cùng một chỗ trên điện thoại lẫn màn rộng.
 */
export function ReadingPassage({ teil }: { teil: RichPassageTeil }) {
  const t = useTranslations('v2.student.mockExamRun')
  const lines = passageLines(teil.context ?? '')
  // Chỉ dòng có chữ mới được đếm — dòng trống giữa hai đoạn không phải một dòng của bài.
  let counted = 0

  return (
    <article className="mb-6 rounded-ga border border-ga-line bg-ga-surface p-4 lg:p-6">
      {teil.title_de && <h3 className="ga-ui mb-2 text-ga-h3 text-ga-ink">{teil.title_de}</h3>}
      {teil.vorspann_de && (
        <p className="ga-ui mb-4 break-words text-ga-body font-semibold text-ga-ink">{teil.vorspann_de}</p>
      )}
      <div className="ga-ui text-ga-body leading-7 text-ga-ink">
        {lines.map((line, idx) => {
          if (line.trim() === '') return <div key={idx} className="h-3" aria-hidden />
          counted += 1
          const showNumber = teil.context_lines && counted % LINE_NUMBER_EVERY === 0
          return (
            <div key={idx} className="flex gap-3">
              <span
                className="ga-ui w-6 shrink-0 select-none text-right text-ga-caption tabular-nums text-ga-subtle"
                aria-hidden={!showNumber}
              >
                {showNumber ? counted : ''}
              </span>
              <span className="min-w-0 break-words">{line}</span>
            </div>
          )
        })}
      </div>
      {teil.glossary && teil.glossary.length > 0 && (
        <dl className="ga-ui mt-4 space-y-1 border-t border-ga-line pt-3 text-ga-small text-ga-muted">
          <p className="sr-only">{t('passageGlossary')}</p>
          {teil.glossary.map((entry) => (
            <div key={entry.term} className="flex gap-2">
              <dt className="shrink-0 font-semibold">*{entry.term}:</dt>
              <dd className="min-w-0 break-words">{entry.explanation_de}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
