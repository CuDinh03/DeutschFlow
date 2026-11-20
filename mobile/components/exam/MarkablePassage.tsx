// Bài đọc có bút đánh dấu (mẫu iOS `attempt`, Đợt 4c, 19/11/2026) — bản app của `PassageMarker` web:
// thanh bút (Từ khoá vàng · Bằng chứng xanh · Chưa chắc hồng · Gạch chân · Tẩy), chọn bút rồi chạm vào
// một câu để tô, chạm lại để xoá. Giữ đúng bố cục của `ReadingPassage` (tiêu đề, Vorspann, số dòng mỗi
// 5 dòng, chú thích từ khó, nguồn). Đánh dấu dùng chung với web (`lib/passageMarks.ts`).

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Eraser } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Icon, ThemedText } from '@/components/ui'
import { lineSegments, sentenceRanges, splitLines, type MarkColor, type MarksPack, type Pen, type Piece } from '@/lib/passageMarks'
import type { MarksStatus } from '@/hooks/usePassageMarks'
import { LINE_NUMBER_EVERY } from './ReadingPassage'

const PENS: { pen: Pen; label: string; a11y: string }[] = [
  { pen: 'y', label: 'Từ khoá', a11y: 'Bút vàng: từ khoá' },
  { pen: 'g', label: 'Bằng chứng', a11y: 'Bút xanh: bằng chứng' },
  { pen: 'p', label: 'Chưa chắc', a11y: 'Bút hồng: chưa chắc' },
  { pen: 'ul', label: 'Gạch chân', a11y: 'Gạch chân' },
  { pen: 'erase', label: 'Tẩy', a11y: 'Tẩy đánh dấu' },
]

interface Props {
  context: string
  title?: string
  vorspann?: string
  numbered: boolean
  glossary?: { term: string; explanation: string }[]
  quelle?: string
  pack: MarksPack
  status: MarksStatus
  dropped: boolean
  saveFailed: boolean
  onApply: (piece: Piece, pen: Pen) => boolean
  onRetry: () => void
}

export function MarkablePassage({ context, title, vorspann, numbered, glossary, quelle, pack, status, dropped, saveFailed, onApply, onRetry }: Props) {
  const c = useTheme().colors
  const [pen, setPen] = useState<Pen>('y')
  const [full, setFull] = useState(false)
  const markColor: Record<MarkColor, string> = { y: c.accentSoft, g: c.successSoft, p: c.dangerSoft }
  const lines = useMemo(() => splitLines(context), [context])
  // Bài đánh số dòng: câu vắt qua dòng tác giả ngắt; bài thường: mỗi xuống dòng là hết đoạn.
  const sentences = useMemo(() => sentenceRanges(context, !numbered), [context, numbered])
  const ready = status === 'ready'

  const tap = (sentence: [number, number] | null) => {
    if (!sentence || !ready) return
    setFull(!onApply({ b: 'ctx', s: sentence[0], e: sentence[1] }, pen))
  }

  let counted = 0
  return (
    <View style={{ gap: space[3] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="toolbar" accessibilityLabel="Bút đánh dấu" contentContainerStyle={{ gap: space[2] }}>
        {PENS.map((p) => {
          const on = pen === p.pen
          return (
            <Pressable
              key={p.pen}
              accessibilityRole="button"
              accessibilityLabel={p.a11y}
              accessibilityState={{ selected: on, disabled: !ready }}
              disabled={!ready}
              hitSlop={4}
              onPress={() => setPen(p.pen)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                height: 36,
                paddingHorizontal: space[3],
                borderRadius: radius.full,
                borderWidth: on ? 2 : 1.5,
                borderColor: on ? c.textPrimary : c.borderStrong,
                backgroundColor: pressed ? c.surfaceSunken : c.surface,
                opacity: ready ? 1 : 0.5,
              })}
            >
              {p.pen === 'y' || p.pen === 'g' || p.pen === 'p' ? (
                <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: markColor[p.pen] }} />
              ) : p.pen === 'erase' ? (
                <Icon icon={Eraser} size={15} color="secondary" />
              ) : null}
              <ThemedText variant="label" color={on ? 'primary' : 'secondary'} style={p.pen === 'ul' ? { textDecorationLine: 'underline' } : undefined}>
                {p.label}
              </ThemedText>
            </Pressable>
          )
        })}
      </ScrollView>

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
                  {lineSegments(context, line, sentences, pack.marks).map((seg) => (
                    <Text
                      key={seg.start}
                      suppressHighlighting={!ready || !seg.sentence}
                      onPress={seg.sentence && ready ? () => tap(seg.sentence) : undefined}
                      style={{
                        backgroundColor: seg.color ? markColor[seg.color] : undefined,
                        color: seg.color ? c.textPrimary : undefined,
                        textDecorationLine: seg.underline ? 'underline' : 'none',
                        textDecorationColor: c.info,
                      }}
                    >
                      {seg.text}
                    </Text>
                  ))}
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

      <MarksStatusLine status={status} dropped={dropped} saveFailed={saveFailed} full={full} onRetry={onRetry} />
    </View>
  )
}

function MarksStatusLine({ status, dropped, saveFailed, full, onRetry }: { status: MarksStatus; dropped: boolean; saveFailed: boolean; full: boolean; onRetry: () => void }) {
  if (status === 'loading') return <ThemedText variant="caption" color="muted">Đang tải đánh dấu bài đọc…</ThemedText>
  if (status === 'error') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
        <ThemedText variant="caption" color="danger" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          Chưa tải được đánh dấu bài đọc, nên chưa tô được.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tải lại đánh dấu bài đọc"
          onPress={onRetry}
          style={({ pressed }) => ({ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space[2], opacity: pressed ? 0.6 : 1 })}
        >
          <ThemedText variant="label" color="info">Thử lại</ThemedText>
        </Pressable>
      </View>
    )
  }
  const notes: string[] = []
  if (full) notes.push('Đã đủ số đánh dấu cho bài này. Tẩy bớt rồi tô tiếp.')
  if (saveFailed) notes.push('Chưa lưu được đánh dấu. App sẽ thử lại khi bạn tô tiếp hoặc rời màn.')
  if (dropped) notes.push('Bài đọc vừa được sửa chữ nên một số đánh dấu cũ đã bỏ.')
  return (
    <ThemedText variant="caption" color={full || saveFailed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
      {notes.length ? notes.join(' ') : 'Chọn bút rồi chạm vào một câu trong bài đọc để tô; chạm lại để xoá. Đánh dấu đồng bộ với bản web.'}
    </ThemedText>
  )
}
