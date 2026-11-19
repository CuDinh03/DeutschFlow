// Một mẩu rao vặt telc Lesen Teil 3 dựng như tờ dán trên bảng tin (mẫu v3.4 `lesen3` `.ad.*`, Đợt 7a).
// Sáu kiểu luân phiên: khung đậm, viết tay, băng đen, nền xám, áp phích viền đôi, chữ đánh máy.
// Phông viết tay và đánh máy là phông hệ thống iOS (Bradley Hand, Courier) — không thêm phông vào app.

import { Platform, View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { adStyleAt, splitAd } from '@/lib/adPoster'

/** Giấy dán bảng tin — màu giấy cố định (như đề in), không theo nền sáng/tối của app. */
const PAPER = '#FFFDF7'
const PAPER_GREY = '#E9E4DA'
const INK = '#1C1B19'
const HAND_FONT = Platform.select({ ios: 'BradleyHandITCTT-Bold', default: undefined })
const TYPE_FONT = Platform.select({ ios: 'Courier', default: 'monospace' })

export function AdPosterCard({ letter, label, index }: { letter: string; label: string; index: number }) {
  const c = useTheme().colors
  const style = adStyleAt(index)
  const { headline, body } = splitAd(label)

  const frame =
    style === 'rahmen' ? { borderWidth: 1.5, borderTopWidth: 6, borderColor: INK, backgroundColor: PAPER }
    : style === 'hand' ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: '#8A847B', backgroundColor: PAPER, transform: [{ rotate: '-1deg' }] }
    : style === 'band' ? { borderWidth: 1, borderColor: '#C9C2B6', backgroundColor: PAPER, paddingTop: 0, paddingHorizontal: 0 }
    : style === 'grau' ? { backgroundColor: PAPER_GREY }
    : style === 'plakat' ? { borderWidth: 3, borderColor: INK, backgroundColor: PAPER }
    : { borderWidth: 1, borderColor: '#C9C2B6', backgroundColor: PAPER }

  const headFont =
    style === 'hand' ? { fontFamily: HAND_FONT, fontSize: 19, lineHeight: 22 }
    : style === 'pixel' ? { fontFamily: TYPE_FONT, letterSpacing: 1, fontSize: 14 }
    : undefined
  const bodyFont = style === 'hand' ? { fontFamily: HAND_FONT, fontSize: 16, lineHeight: 20 } : undefined
  const center = style === 'grau' || style === 'plakat'

  return (
    <View
      accessible
      accessibilityLabel={`Mẩu ${letter}. ${label}`}
      accessibilityLanguage="de-DE"
      style={[{ padding: space[3], borderRadius: 3, overflow: 'visible', marginTop: 6, marginLeft: 6 }, frame]}
    >
      <View
        style={{
          position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, zIndex: 1,
          backgroundColor: c.inkSurface, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ThemedText variant="label" style={{ color: c.onInk }}>{letter}</ThemedText>
      </View>
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
          style === 'band' ? { paddingHorizontal: space[3], paddingBottom: space[2] } : null,
          bodyFont ?? null,
        ]}
      >
        {body}
      </ThemedText>
    </View>
  )
}
