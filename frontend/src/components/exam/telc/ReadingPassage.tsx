'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { evidenceRanges } from '@/lib/exam/evidenceRanges'
import { MarkedText, type EvidenceRange, type MarkLayer } from '@/components/exam/marks/MarkedText'
import { lastPieces } from '@/components/exam/marks/marksModel'

/** Những khoá của một bài đọc dài kiểu đề thật — tập con của Teil trong `sections_json`. */
export interface RichPassageTeil {
  context?: string
  title_de?: string
  vorspann_de?: string
  context_lines?: boolean
  glossary?: Array<{ term: string; explanation_de: string }>
  /**
   * Nguồn của bài đọc (Xưởng đề, V376): `quelle` là dòng ghi nguồn bắt buộc theo giấy phép (CC BY:
   * tác giả + giấy phép + "bearbeitet"; báo: "Daten: …"), hiện nhỏ dưới bài. Đề viết tay không khai.
   */
  source?: { quelle?: string | null }
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

/** Chữ bài đọc đã chuẩn hoá xuống dòng — khối `ctx` của đánh dấu bài đọc tính vị trí trên chuỗi này. */
export function passageText(context: string): string {
  return context.replace(/\r\n/g, '\n')
}

export interface PassageLine {
  /** Vị trí đầu / cuối (không gồm `\n`) trên `passageText`. */
  start: number
  end: number
  /** Số dòng của bài (chỉ dòng có chữ mới đếm); dòng trống ⇒ `null`. */
  number: number | null
}

/** Dòng tác giả ngắt + vị trí ký tự + số dòng — dùng chung cho vẽ bài và "dòng 6–7" khi chẩn đoán. */
export function passageLineMap(context: string): PassageLine[] {
  const out: PassageLine[] = []
  let at = 0
  let counted = 0
  for (const line of passageLines(context)) {
    const blank = line.trim() === ''
    if (!blank) counted += 1
    out.push({ start: at, end: at + line.length, number: blank ? null : counted })
    at += line.length + 1
  }
  return out
}

/** Số dòng chứa vị trí ký tự (dòng trống ⇒ dòng có chữ gần nhất phía trước). */
export function lineNumberAt(lines: readonly PassageLine[], offset: number): number {
  let n = 1
  for (const l of lines) {
    if (l.start > offset) break
    if (l.number != null) n = l.number
  }
  return n
}

/**
 * Bài đọc dài của Leseverstehen Teil 2 (telc), dựng như trang đề thật: tiêu đề, **Vorspann** in
 * đậm, thân bài có **số dòng mỗi 5 dòng** ở lề trái, chú thích từ khó (*) dưới bài.
 *
 * Vì sao cần: đề thật đánh số dòng để thí sinh định vị nhanh khi câu hỏi không theo thứ tự bài,
 * và có Vorspann + chú thích — ba thứ mà một khối văn bản liền không cho. Số dòng đếm theo dòng
 * TÁC GIẢ ngắt (seed viết mỗi dòng ≈ 10 từ), không theo dòng trình duyệt bẻ, để cùng một số dòng
 * trỏ cùng một chỗ trên điện thoại lẫn màn rộng.
 *
 * Thân bài vẽ qua `MarkedText` (09/11/2026): mỗi đoạn chữ mang vị trí ký tự để học viên đánh dấu
 * được (`layer`), và bằng chứng sau kiểm tra là gạch xanh đứt tìm theo `evidenceRanges` — câu trích
 * vắt qua hai dòng giờ cũng được tô (bản cũ so trong từng dòng nên bỏ sót).
 */
export function ReadingPassage({
  teil,
  highlights = [],
  evidenceLabel,
  layer,
}: {
  teil: RichPassageTeil
  /** Câu trích bằng chứng của câu đang xem lời giải (sau khi kiểm tra). */
  highlights?: string[]
  /** Nhãn cuối đoạn bằng chứng, ví dụ "Đ/A 7". */
  evidenceLabel?: string
  /** Lớp đánh dấu của học viên (luyện Teil). */
  layer?: MarkLayer | null
}) {
  const t = useTranslations('v2.student.mockExamRun')
  const text = React.useMemo(() => passageText(teil.context ?? ''), [teil.context])
  const lines = React.useMemo(() => passageLineMap(text), [text])
  const evidence = React.useMemo<EvidenceRange[]>(() => {
    const ranges = evidenceRanges(text, highlights)
    return ranges.map(([s, e], i) => ({ b: 'ctx', s, e, label: i === ranges.length - 1 ? evidenceLabel : undefined }))
  }, [text, highlights, evidenceLabel])
  const last = React.useMemo(() => (layer ? lastPieces(layer.pack, layer.blockOrder) : undefined), [layer])

  return (
    <article className="mb-6 rounded-ga border border-ga-line bg-ga-surface p-4 lg:p-6">
      {teil.title_de && <h3 className="ga-ui mb-2 text-ga-h3 text-ga-ink">{teil.title_de}</h3>}
      {teil.vorspann_de && (
        <p className="ga-ui mb-4 break-words text-ga-body font-semibold text-ga-ink">{teil.vorspann_de}</p>
      )}
      <div lang="de" className="ga-ui text-ga-body leading-7 text-ga-ink">
        {lines.map((line, idx) => {
          if (line.number == null) return <div key={idx} className="h-3" aria-hidden />
          const showNumber = teil.context_lines && line.number % LINE_NUMBER_EVERY === 0
          return (
            <div key={idx} className="flex gap-3">
              <span
                className="ga-ui w-6 shrink-0 select-none text-right text-ga-caption tabular-nums text-ga-subtle"
                aria-hidden={!showNumber}
              >
                {showNumber ? line.number : ''}
              </span>
              {/* vùng chọn kéo qua hai dòng vẫn đổi đúng ra vị trí nhờ data-s của từng đoạn */}
              <span className="min-w-0 break-words">
                <MarkedText block="ctx" text={text} from={line.start} to={line.end} layer={layer} evidence={evidence} lastByGroup={last} />
              </span>
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
      {teil.source?.quelle && (
        <p data-quelle className="ga-ui mt-3 break-words text-ga-caption text-ga-subtle">{teil.source.quelle}</p>
      )}
    </article>
  )
}
