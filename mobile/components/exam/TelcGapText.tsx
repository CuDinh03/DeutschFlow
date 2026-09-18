import { View } from 'react-native'
import { ThemedText, Caption } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import type { ExamObjItem } from '@/lib/examApi'

/**
 * Văn bản có ô trống đánh số (`___31___`) của hai dạng điền khuyết telc.
 *
 * Ô trống hiện thành một ô nhỏ mang số và đáp án đang chọn; việc CHỌN làm ở danh sách câu bên
 * dưới — đúng như đề giấy (văn bản một bên, lựa chọn một bên), và nhờ vậy không cần cửa sổ bật
 * lên trên màn hình hẹp.
 */
export function TelcGapText({
  text,
  items,
  answers,
  showWord,
}: {
  text: string
  items: ExamObjItem[]
  answers: Record<string, string>
  /** Hộp từ thì hiện TỪ đã chọn; trắc nghiệm thì hiện chữ cái. */
  showWord: boolean
}) {
  const { colors: c } = useTheme()
  const byGap = new Map<number, ExamObjItem>()
  for (const it of items) if (it.gap != null && !byGap.has(it.gap)) byGap.set(it.gap, it)

  const segments: ({ kind: 'text'; value: string } | { kind: 'gap'; gap: number })[] = []
  const pattern = /_{3,}\s*(\d+)\s*_{3,}/g
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > cursor) segments.push({ kind: 'text', value: text.slice(cursor, m.index) })
    segments.push({ kind: 'gap', gap: Number(m[1]) })
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) })

  return (
    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
      <Caption>Văn bản</Caption>
      <ThemedText variant="body" color="secondary">
        {segments.map((seg, i) => {
          if (seg.kind === 'text') return seg.value
          const item = byGap.get(seg.gap)
          const picked = item ? answers[item.id] : undefined
          let shown = 'chưa chọn'
          if (picked) {
            if (!showWord) shown = picked
            else {
              const idx = item?.optionKeys?.indexOf(picked) ?? -1
              shown = idx >= 0 ? (item?.options?.[idx] ?? picked) : picked
            }
          }
          return ` [${seg.gap}: ${shown}] `
        })}
      </ThemedText>
    </View>
  )
}
