// GaGlyph — biểu tượng nhận diện của app (bộ Galerie), thay Lucide + emoji ở tab bar, ô tính
// năng, checklist, trạng thái, chủ đề lộ trình. Lucide (qua `Icon`) chỉ còn cho ĐIỀU KHIỂN
// (chevron, đóng, tick, mắt, tìm kiếm, gửi…). Tài liệu: `mobile/GALERIE_GLYPHS.md`.
//
// Thứ tự vẽ: mảng vàng → mảng đỏ → nét mực, để nét không bao giờ bị mảng màu che.

import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import { radius, useTheme } from '@/lib/theme'
import { GLYPHS, GLYPH_STROKE, GLYPH_VIEWBOX, type GlyphName, type GlyphShape } from '@/lib/galerieGlyphs'

export type GlyphInkRole =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'accentText'
  | 'brand'
  | 'success'
  | 'danger'
  | 'info'
  | 'onAccent'
  | 'onInk'

/** Màu mảng vàng: `accent` (mặc định) · `ink` (trùng màu nét — dùng trên nền vàng) · vai trò khác · `none`. */
export type GlyphGold = 'accent' | 'ink' | 'success' | 'danger' | 'info' | 'none'

export interface GaGlyphProps {
  name: GlyphName
  size?: number
  ink?: GlyphInkRole
  gold?: GlyphGold
  /** Ghi đè màu nét bằng mã màu (ô chủ đề có tông riêng). Ưu tiên hơn `ink`. */
  inkColor?: string
  /** Ghi đè màu mảng vàng bằng mã màu. Ưu tiên hơn `gold`. */
  goldColor?: string
  strokeWidth?: number
  /** Có nhãn → phần tử accessible; không có → ẩn với screen reader (chữ cạnh bên đã nói đủ). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

function renderShapes(list: GlyphShape[], prefix: string) {
  return list.map((s, i) => {
    const key = `${prefix}${i}`
    if (typeof s === 'string') return <Path key={key} d={s} />
    if ('r' in s) return <Rect key={key} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} />
    return <Circle key={key} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} />
  })
}

export function GaGlyph({
  name,
  size = 20,
  ink = 'primary',
  gold = 'accent',
  inkColor,
  goldColor,
  strokeWidth = GLYPH_STROKE,
  accessibilityLabel,
  style,
}: GaGlyphProps) {
  const c = useTheme().colors
  const def = GLYPHS[name]
  const inkMap: Record<GlyphInkRole, string> = {
    primary: c.textPrimary,
    secondary: c.textSecondary,
    muted: c.textMuted,
    faint: c.textFaint,
    accent: c.accent,
    accentText: c.accentText,
    brand: c.brand,
    success: c.success,
    danger: c.danger,
    info: c.info,
    onAccent: c.onAccent,
    onInk: c.onInk,
  }
  const inkResolved = inkColor ?? inkMap[ink]
  const goldMap: Record<GlyphGold, string> = {
    accent: c.accent,
    ink: inkResolved,
    success: c.success,
    danger: c.danger,
    info: c.info,
    none: 'transparent',
  }
  const goldResolved = goldColor ?? goldMap[gold]
  const labelled = !!accessibilityLabel
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${GLYPH_VIEWBOX} ${GLYPH_VIEWBOX}`}
      style={style}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? 'auto' : 'no-hide-descendants'}
    >
      <G fill={goldResolved}>{renderShapes(def.gold, 'g')}</G>
      {def.red ? <G fill={c.danger}>{renderShapes(def.red, 'r')}</G> : null}
      <G fill="none" stroke={inkResolved} strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter">
        {renderShapes(def.ink, 'i')}
      </G>
    </Svg>
  )
}

/** Tông ô icon: `accent` (vàng mờ) · `neutral` (surfaceSunken) · `ink` (thẻ mực) · success · danger · info. */
export type GlyphTileTone = 'accent' | 'neutral' | 'ink' | 'success' | 'danger' | 'info'

export interface GaGlyphTileProps {
  name: GlyphName
  tone?: GlyphTileTone
  /** Cạnh ô (px). Glyph mặc định = một nửa cạnh ô. */
  size?: number
  glyphSize?: number
  radius?: number
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/** Ô vuông bo 4 px chứa một glyph — mẫu chung cho hàng danh sách, ô tính năng, thẻ thống kê. */
export function GaGlyphTile({
  name,
  tone = 'accent',
  size = 40,
  glyphSize,
  radius: r = radius.md,
  style,
  accessibilityLabel,
}: GaGlyphTileProps) {
  const c = useTheme().colors
  const toneStyle: Record<GlyphTileTone, { bg: string; ink: GlyphInkRole; gold: GlyphGold }> = {
    accent: { bg: c.accentSoft, ink: 'primary', gold: 'accent' },
    neutral: { bg: c.surfaceSunken, ink: 'primary', gold: 'accent' },
    ink: { bg: c.inkSurface, ink: 'onInk', gold: 'accent' },
    success: { bg: c.successSoft, ink: 'success', gold: 'success' },
    danger: { bg: c.dangerSoft, ink: 'danger', gold: 'danger' },
    info: { bg: c.infoSoft, ink: 'info', gold: 'info' },
  }
  const t = toneStyle[tone]
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: r, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <GaGlyph name={name} size={glyphSize ?? Math.round(size / 2)} ink={t.ink} gold={t.gold} accessibilityLabel={accessibilityLabel} />
    </View>
  )
}
