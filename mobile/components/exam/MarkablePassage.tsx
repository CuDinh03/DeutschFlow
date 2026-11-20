// Bài đọc Lesen 2 có bút đánh dấu (mẫu iOS `attempt`, Đợt 4c 19/11/2026; Đợt 4f 20/11 tách thanh bút ra
// `MarksToolbar` dùng chung cả Teil) — bản app của `PassageMarker` web: chọn bút rồi chạm vào một câu để
// tô, chạm lại để xoá. Giữ đúng bố cục của `ReadingPassage` (tiêu đề, Vorspann, số dòng mỗi 5 dòng, chú
// thích từ khó, nguồn). Đánh dấu dùng chung với web (`lib/passageMarks.ts`), khối `ctx`.

import { useMemo } from 'react'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, ThemedText } from '@/components/ui'
import { sentenceRanges, splitLines } from '@/lib/passageMarks'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { LINE_NUMBER_EVERY } from './ReadingPassage'
import { MarkedRun } from './MarkedRun'

interface Props {
  layer: MarksLayer
  title?: string
  vorspann?: string
  numbered: boolean
  glossary?: { term: string; explanation: string }[]
  quelle?: string
}

export function MarkablePassage({ layer, title, vorspann, numbered, glossary, quelle }: Props) {
  const c = useTheme().colors
  const context = layer.texts.ctx ?? ''
  const lines = useMemo(() => splitLines(context), [context])
  // Bài đánh số dòng: câu vắt qua dòng tác giả ngắt; bài thường: mỗi xuống dòng là hết đoạn.
  const sentences = useMemo(() => sentenceRanges(context, !numbered), [context, numbered])

  let counted = 0
  return (
    <View
      accessibilityHint="Chọn bút rồi chạm vào một câu để tô, chạm lại để xoá."
      style={{ gap: space[2], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space[4] }}
    >
      <Caption>Bài đọc</Caption>
      {title ? <ThemedText variant="title" accessibilityLanguage="de-DE">{title}</ThemedText> : null}
      {vorspann ? <ThemedText variant="bodyStrong" accessibilityLanguage="de-DE">{vorspann}</ThemedText> : null}
      <View>
        {lines.map((line, idx) => {
          if (line.text.trim() === '') return <View key={idx} style={{ height: space[2] }} />
          counted += 1
          const show = numbered && counted % LINE_NUMBER_EVERY === 0
          return (
            <View key={idx} style={{ flexDirection: 'row', gap: space[2] }}>
              {numbered ? (
                <ThemedText variant="caption" color="faint" style={{ width: 22, textAlign: 'right', paddingTop: 3 }}>
                  {show ? String(counted) : ''}
                </ThemedText>
              ) : null}
              <ThemedText variant="body" style={{ flex: 1, color: c.textSecondary }} accessibilityLanguage="de-DE">
                <MarkedRun layer={layer} block="ctx" from={line.start} to={line.end} sentences={sentences} />
              </ThemedText>
            </View>
          )
        })}
      </View>
      {glossary && glossary.length > 0 ? (
        <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2] }}>
          <Caption>Chú thích từ khó</Caption>
          {glossary.map((g) => (
            <ThemedText key={g.term} variant="caption" color="secondary">{`*${g.term}: ${g.explanation}`}</ThemedText>
          ))}
        </View>
      ) : null}
      {quelle ? <ThemedText variant="caption" color="faint">{quelle}</ThemedText> : null}
    </View>
  )
}
