import { View } from 'react-native'
import { ThemedText, Caption } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import type { ExamObjItem } from '@/lib/examApi'
import { gapPieces, matchBlock } from '@/lib/marksBlocks'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { MarkedRun } from './MarkedRun'

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
  marks,
}: {
  text: string
  items: ExamObjItem[]
  answers: Record<string, string>
  /** Hộp từ thì hiện TỪ đã chọn; trắc nghiệm thì hiện chữ cái. */
  showWord: boolean
  /** Bút đánh dấu (khối `gap`, Đợt 4f): đoạn chữ giữa các ô trống chạm từng câu để tô. */
  marks?: MarksLayer | null
}) {
  const { colors: c } = useTheme()
  const byGap = new Map<number, ExamObjItem>()
  for (const it of items) if (it.gap != null && !byGap.has(it.gap)) byGap.set(it.gap, it)

  const block = marks ? matchBlock(marks.texts, 'gap', text) : null
  const source = block && marks ? marks.texts.gap : text
  const pieces = gapPieces(source)

  const gapLabel = (gap: number) => {
    const item = byGap.get(gap)
    const picked = item ? answers[item.id] : undefined
    let shown = 'chưa chọn'
    if (picked) {
      if (!showWord) shown = picked
      else {
        const idx = item?.optionKeys?.indexOf(picked) ?? -1
        shown = idx >= 0 ? (item?.options?.[idx] ?? picked) : picked
      }
    }
    return ` [${gap}: ${shown}] `
  }

  return (
    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
      <Caption>Văn bản</Caption>
      <ThemedText variant="body" color="secondary" accessibilityLanguage="de-DE">
        {pieces.map((p) => {
          if (p.kind === 'gap') return <ThemedText key={p.s} variant="bodyStrong">{gapLabel(p.gap)}</ThemedText>
          if (block && marks) return <MarkedRun key={p.s} layer={marks} block={block} from={p.s} to={p.e} />
          return source.slice(p.s, p.e)
        })}
      </ThemedText>
    </View>
  )
}
