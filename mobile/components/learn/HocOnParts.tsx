// Linh kiện trình bày dùng chung cho nhóm màn Học và ôn (giao diện v3.4, Đợt 6A, 19/11/2026).
// Mỗi linh kiện ứng một lớp CSS của mẫu `mau-ios-v3-4.html`: `.eyebrow`, `.lt .mark`, `.seg2`,
// `.chip`/`.rail`, `.badge`, `.art`, `.list .li`, `.gi`, `.sec-h`, `.rate`, `.brief`.
// Chỉ trình bày: không gọi API, không giữ trạng thái.

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react-native'
import { ArrowLeft } from 'lucide-react-native'
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { fonts, radius, space, themeShadowStyle, useTheme } from '@/lib/theme'
import { BrushMark, GaGlyph, IconButton, ThemedText } from '@/components/ui'
import type { GlyphName } from '@/lib/galerieGlyphs'
import type { BadgeTone } from '@/lib/hocOnUi'

const TOUCH = 44

/** Hàng đầu màn: nút quay lại/thoát, tên màn ở giữa (tuỳ chọn), ô phải (tuỳ chọn, mặc định chừa 44pt). */
export function TopBar({
  onBack,
  backIcon = ArrowLeft,
  backLabel = 'Quay lại',
  title,
  subtitle,
  right,
  children,
}: {
  onBack: () => void
  backIcon?: LucideIcon
  backLabel?: string
  title?: string
  subtitle?: string
  right?: ReactNode
  /** Thay phần giữa (vd. thanh tiến độ của màn luyện tập). */
  children?: ReactNode
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], paddingTop: space[2], minHeight: TOUCH }}>
      <IconButton icon={backIcon} accessibilityLabel={backLabel} onPress={onBack} color="primary" />
      <View style={{ flex: 1, alignItems: children ? 'stretch' : 'center' }}>
        {children ?? (
          <>
            {title ? (
              <ThemedText variant="label" accessibilityRole="header" numberOfLines={1}>
                {title}
              </ThemedText>
            ) : null}
            {subtitle ? (
              <ThemedText variant="caption" color="muted" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
      {right ?? <View style={{ width: 22 }} />}
    </View>
  )
}

/** `.eyebrow`: chữ nhỏ in hoa, giãn chữ. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
        {children}
      </ThemedText>
    </View>
  )
}

/** `.lt` + `.mark`: tiêu đề lớn, phần `mark` có vệt vàng. */
export function HeroTitle({ lead, mark, style }: { lead?: string; mark: string; style?: StyleProp<ViewStyle> }) {
  const full = [lead, mark].filter(Boolean).join(' ')
  return (
    <View
      style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2] }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={full}
    >
      {lead ? <ThemedText variant="display">{lead}</ThemedText> : null}
      {mark ? <BrushMark>{mark}</BrushMark> : null}
    </View>
  )
}

/** `.seg2`: thanh chia đoạn, các ô chia đều. */
export function SegTabs<K extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: readonly { key: K; label: string }[]
  value: K | null
  onChange: (key: K) => void
  style?: StyleProp<ViewStyle>
}) {
  const c = useTheme().colors
  return (
    <View
      accessibilityRole="tablist"
      style={[
        { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border },
        style,
      ]}
    >
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              if (on) return
              void Haptics.selectionAsync()
              onChange(t.key)
            }}
            style={{
              flex: 1,
              height: 36,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.surface : 'transparent',
              shadowColor: '#000',
              shadowOpacity: on ? 0.08 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <ThemedText variant="label" numberOfLines={1} style={{ color: on ? c.textPrimary : c.textMuted }}>
              {t.label}
            </ThemedText>
          </Pressable>
        )
      })}
    </View>
  )
}

/** `.rail`: hàng cuộn ngang tràn hai mép màn. */
export function Rail({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -space[5], flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: space[5], gap: space[2], paddingVertical: 2 }}
    >
      {children}
    </ScrollView>
  )
}

/** `.chip` (và `.chip.on`). Có `onPress` thì là nút; không thì chỉ hiển thị. */
export function Chip({
  label,
  on = false,
  onPress,
  accessibilityLabel,
  leading,
  disabled = false,
}: {
  label: string
  on?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  leading?: ReactNode
  disabled?: boolean
}) {
  const c = useTheme().colors
  const body = (
    <>
      {leading}
      <ThemedText variant="label" numberOfLines={1} style={{ color: on ? c.onInk : c.textSecondary }}>
        {label}
      </ThemedText>
    </>
  )
  const box: ViewStyle = {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: on ? c.inkSurface : c.surfaceSunken,
    borderWidth: 1,
    borderColor: on ? c.inkSurface : c.border,
    opacity: disabled ? 0.5 : 1,
  }
  if (!onPress) {
    return (
      <View style={box} accessible accessibilityLabel={accessibilityLabel ?? label}>
        {body}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => [box, pressed ? { opacity: 0.7 } : null]}
    >
      {body}
    </Pressable>
  )
}

/** `.badge` (`.y` vàng, `.g` xanh, `.r` đỏ, `.k` mực). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const c = useTheme().colors
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: c.surfaceSunken, fg: c.textSecondary },
    yellow: { bg: c.accentSoft, fg: c.textPrimary },
    // Chữ mực trên nền nhạt: xanh/đỏ trên nền nhạt không đạt 4,5:1 (soát Đợt 6A).
    green: { bg: c.successSoft, fg: c.textPrimary },
    red: { bg: c.dangerSoft, fg: c.textPrimary },
    ink: { bg: c.inkSurface, fg: c.onInk },
  }
  const t = map[tone]
  return (
    <View style={{ height: 24, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: t.bg, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <ThemedText variant="caption" style={{ color: t.fg, fontFamily: fonts.bodyBold }} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  )
}

/** `.art`: viên mạo từ der/die/das nền đặc. */
export function ArtBadge({ gender, label, small = false }: { gender: 'der' | 'die' | 'das'; label?: string; small?: boolean }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        height: small ? 22 : 26,
        paddingHorizontal: small ? 8 : 10,
        borderRadius: radius.full,
        // Viền màu mạo từ + nền nhạt cùng màu, chữ mực: chữ trắng trên xanh "das" chỉ 3,57:1.
        backgroundColor: `${c[gender]}22`,
        borderWidth: 1.5,
        borderColor: c[gender],
        justifyContent: 'center',
        alignSelf: 'center',
      }}
    >
      <ThemedText variant="caption" style={{ color: c.textPrimary, fontFamily: fonts.bodyBold, fontSize: small ? 11 : 13 }} accessibilityLanguage="de-DE">
        {label ?? gender}
      </ThemedText>
    </View>
  )
}

/** `.list`: khung danh sách (các hàng ngăn bằng đường kẻ trên). */
export function ListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  const c = theme.colors
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, overflow: 'hidden' },
        themeShadowStyle(theme.shadow.card),
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** `.li`: một hàng của danh sách. `first` bỏ đường kẻ trên. */
export function ListItem({
  first,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  style,
}: {
  first: boolean
  children: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const c = useTheme().colors
  const box: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: space[4],
    borderTopWidth: first ? 0 : 1,
    borderTopColor: c.border,
  }
  if (!onPress) return <View style={[box, style]}>{children}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => [box, pressed ? { backgroundColor: c.surfaceSunken } : null, style]}
    >
      {children}
    </Pressable>
  )
}

export type GlyphTileTone = 'neutral' | 'yellow' | 'green'

/** `.gi`: ô biểu tượng 36×36 đầu hàng. */
export function GlyphTile({ name, tone = 'neutral', size = 36 }: { name: GlyphName; tone?: GlyphTileTone; size?: number }) {
  const c = useTheme().colors
  const bg = tone === 'yellow' ? c.accent : tone === 'green' ? c.successSoft : c.surfaceSunken
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <GaGlyph name={name} size={Math.round(size * 0.55)} ink={tone === 'green' ? 'success' : 'primary'} gold={tone === 'yellow' ? 'ink' : tone === 'green' ? 'success' : 'accent'} />
    </View>
  )
}

/** `.sec-h`: tiêu đề mục + chữ nhỏ bên phải. */
export function SectionHead({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space[6], marginBottom: space[3] }, style]}>
      <ThemedText variant="title" accessibilityRole="header">
        {title}
      </ThemedText>
      {typeof right === 'string' ? (
        <ThemedText variant="caption" color="muted">
          {right}
        </ThemedText>
      ) : (
        right ?? null
      )}
    </View>
  )
}

/** `.brief`: tờ giấy có lề đỏ (câu tiếng Đức mẫu, câu sai cần sửa). */
export function RuledNote({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme().colors
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: space[3], paddingRight: space[4], paddingLeft: 30 },
        style,
      ]}
    >
      <View pointerEvents="none" style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 1.5, backgroundColor: c.dangerSoft }} />
      {children}
    </View>
  )
}
