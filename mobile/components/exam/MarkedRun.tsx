// Chữ của một khối đánh dấu (hoặc một đoạn `[from, to)` của khối) qua lớp bút — Đợt 4f, 20/11/2026.
// Trả các <Text> lồng, đặt BÊN TRONG một <ThemedText>/<Text> cha (kiểu chữ của chỗ dùng giữ nguyên).
// Chạm một câu ⇒ áp bút đang chọn (tô / gạch chân / tẩy) như bài đọc Lesen 2 (`MarkablePassage`).

import { useMemo } from 'react'
import { Text } from 'react-native'
import { useTheme, type ThemeColors } from '@/lib/theme'
import { lineSegments, sentencesIn, type MarkColor } from '@/lib/passageMarks'
import type { MarksLayer } from '@/hooks/usePassageMarks'

/** Màu nền của ba bút (token theme — cùng bảng với thanh bút). */
export function markBackground(c: ThemeColors, color: MarkColor): string {
  return color === 'y' ? c.accentSoft : color === 'g' ? c.successSoft : c.dangerSoft
}

export function MarkedRun({
  layer,
  block,
  from = 0,
  to,
  splitOnNewline = true,
  sentences: given,
}: {
  layer: MarksLayer
  block: string
  from?: number
  to?: number
  /** Bài đánh số dòng: câu vắt qua dòng tác giả ngắt (`false`); chữ thường: xuống dòng là hết đoạn. */
  splitOnNewline?: boolean
  /** Câu của cả khối do chỗ dùng tính sẵn (bài đọc vẽ từng dòng nhưng câu vắt qua nhiều dòng). */
  sentences?: readonly [number, number][]
}) {
  const c = useTheme().colors
  const text = layer.texts[block] ?? ''
  const end = Math.min(to ?? text.length, text.length)
  const own = useMemo(() => (given ? null : sentencesIn(text, from, end, splitOnNewline)), [given, text, from, end, splitOnNewline])
  const sentences = given ?? own ?? []
  const editable = layer.status === 'ready' && !layer.hidden
  const marks = layer.hidden ? [] : layer.pack.marks
  const segs = lineSegments(text, { start: from, end, text: '' }, sentences, marks, block)
  return (
    <>
      {segs.map((seg) => (
        <Text
          key={seg.start}
          suppressHighlighting={!editable || !seg.sentence}
          onPress={editable && seg.sentence ? () => layer.tap({ b: block, s: seg.sentence![0], e: seg.sentence![1] }) : undefined}
          style={{
            backgroundColor: seg.color ? markBackground(c, seg.color) : undefined,
            color: seg.color ? c.textPrimary : undefined,
            textDecorationLine: seg.underline ? 'underline' : 'none',
            textDecorationColor: c.info,
          }}
        >
          {seg.text}
        </Text>
      ))}
    </>
  )
}
