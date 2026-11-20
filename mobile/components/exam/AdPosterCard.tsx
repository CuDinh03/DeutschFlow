// Một mẩu rao vặt telc Lesen Teil 3 dựng như tờ dán trên bảng tin (mẫu v3.4 `lesen3` `.ad.*`, Đợt 7a).
// Sáu kiểu luân phiên: khung đậm, viết tay, băng đen, nền xám, áp phích viền đôi, chữ đánh máy.
// Phông viết tay và đánh máy là phông hệ thống iOS (Bradley Hand, Courier) — không thêm phông vào app.
// 20/11: chạm mẩu (`onPress`) ⇒ khay chọn tình huống (`AdBoard`); mẩu đã gán hiện nhãn "Câu 14" góc phải.

import { Platform, Pressable, View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { adStyleAt, splitAdRanges } from '@/lib/adPoster'
import { matchBlock } from '@/lib/marksBlocks'
import type { MarksLayer } from '@/hooks/usePassageMarks'
import { MarkedRun } from './MarkedRun'

/** Giấy dán bảng tin — màu giấy cố định (như đề in), không theo nền sáng/tối của app. */
const PAPER = '#FFFDF7'
const PAPER_GREY = '#E9E4DA'
const INK = '#1C1B19'
const HAND_FONT = Platform.select({ ios: 'BradleyHandITCTT-Bold', default: undefined })
const TYPE_FONT = Platform.select({ ios: 'Courier', default: 'monospace' })

export function AdPosterCard({
  letter,
  label,
  index,
  marks,
  assignedTo,
  onPress,
}: {
  letter: string
  label: string
  index: number
  marks?: MarksLayer | null
  /** Số tình huống đang dùng mẩu này (đã gán) — hiện nhãn góc phải. */
  assignedTo?: string[]
  /** Có ⇒ chạm mẩu mở khay chọn tình huống. */
  onPress?: () => void
}) {
  const c = useTheme().colors
  const style = adStyleAt(index)
  // Bút đánh dấu (khối `ad:<k>`, Đợt 4f): vẽ tiêu đề / thân từ chữ của khối để vị trí khớp server.
  const block = marks ? matchBlock(marks.texts, `ad:${letter}`, label) : null
  const source = block && marks ? marks.texts[block] : label
  const ranges = splitAdRanges(source)
  const run = (r: [number, number]) =>
    block && marks ? <MarkedRun layer={marks} block={block} from={r[0]} to={r[1]} /> : source.slice(r[0], r[1])
  const headline = ranges.headline ? run(ranges.headline) : null
  const body = run(ranges.body)

  const frame =
    style === 'rahmen' ? { borderWidth: 1.5, borderTopWidth: 6, borderColor: INK, backgroundColor: PAPER }
    : style === 'hand' ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: '#8A847B', backgroundColor: PAPER, transform: [{ rotate: '-1deg' }] }
    : style === 'band' ? { borderWidth: 1, borderColor: '#C9C2B6', backgroundColor: PAPER, ...(headline ? { paddingTop: 0, paddingHorizontal: 0 } : null) }
    : style === 'grau' ? { backgroundColor: PAPER_GREY }
    : style === 'plakat' ? { borderWidth: 3, borderColor: INK, backgroundColor: PAPER }
    : { borderWidth: 1, borderColor: '#C9C2B6', backgroundColor: PAPER }

  const headFont =
    style === 'hand' ? { fontFamily: HAND_FONT, fontSize: 19, lineHeight: 22 }
    : style === 'pixel' ? { fontFamily: TYPE_FONT, letterSpacing: 1, fontSize: 14 }
    : undefined
  const bodyFont = style === 'hand' ? { fontFamily: HAND_FONT, fontSize: 16, lineHeight: 20 } : undefined
  const center = style === 'grau' || style === 'plakat'

  const used = assignedTo ?? []
  const penOn = !!block && !!marks && marks.pen != null && marks.status === 'ready' && !marks.hidden
  return (
    <Pressable
      accessible
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Mẩu ${letter}${used.length ? `, đang chọn cho câu ${used.join(', ')}` : ''}. ${label}`}
      accessibilityHint={
        onPress
          ? penOn
            ? 'Đang bật bút: chạm chữ để tô, chạm chữ cái của mẩu để chọn tình huống.'
            : 'Chạm để chọn tình huống hợp với mẩu này.'
          : undefined
      }
      accessibilityLanguage="de-DE"
      style={({ pressed }) => [
        { padding: space[3], borderRadius: 3, overflow: 'visible' as const, marginTop: 6, marginLeft: 6, opacity: pressed ? 0.8 : 1 },
        frame,
      ]}
    >
      <View
        style={{
          position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, zIndex: 1,
          backgroundColor: c.inkSurface, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ThemedText variant="label" style={{ color: c.onInk }}>{letter}</ThemedText>
      </View>
      {used.length ? (
        <View
          style={{
            position: 'absolute', top: -10, right: -4, zIndex: 1, paddingHorizontal: space[2], height: 24,
            borderRadius: 12, backgroundColor: c.info, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ThemedText variant="label" style={{ color: c.onBrand, fontVariant: ['tabular-nums'] }}>{`Câu ${used.join(', ')}`}</ThemedText>
        </View>
      ) : null}
      {headline ? (
        style === 'band' ? (
          <View style={{ backgroundColor: INK, paddingHorizontal: space[3], paddingVertical: space[2], marginBottom: space[2], borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm }}>
            <ThemedText variant="bodyStrong" style={{ color: PAPER }}>{headline}</ThemedText>
          </View>
        ) : (
          <ThemedText
            variant={style === 'plakat' ? 'title' : 'bodyStrong'}
            style={[
              { color: INK, marginBottom: 3, textAlign: center ? 'center' : 'left' },
              style === 'pixel' ? { borderBottomWidth: 0, textDecorationLine: 'underline', textDecorationStyle: 'dotted' } : null,
              headFont ?? null,
            ]}
          >
            {headline}
          </ThemedText>
        )
      ) : null}
      <ThemedText
        variant="caption"
        style={[
          { color: INK, textAlign: center ? 'center' : 'left', fontStyle: style === 'grau' ? 'italic' : 'normal' },
          style === 'band' && headline ? { paddingHorizontal: space[3], paddingBottom: space[2] } : null,
          bodyFont ?? null,
        ]}
      >
        {body}
      </ThemedText>
    </Pressable>
  )
}
