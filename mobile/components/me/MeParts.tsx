// Mảnh giao diện dùng chung cho nhóm màn "Tôi và cài đặt" (giao diện v3.4, Đợt 6C, 19/11/2026):
// Tôi, Thông tin cá nhân, Đổi mật khẩu, An toàn và chặn, Chứng nhận, Phiếu gửi gia đình, Nâng cấp,
// Hướng dẫn, tab Tiến bộ. Gương các lớp `.eyebrow` `.t1` `.lt .mark` `.list .li .gi` `.sec-h` `.badge`
// của mẫu `plans/ios-v3.4-mau/mau-ios-v3-4.html`.

import { Children, type ReactNode } from 'react'
import { Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { BrushMark, GaGlyph, Icon, IconButton, ThemedText } from '@/components/ui'

/** Nhãn nhỏ viết hoa phía trên khối (`.eyebrow`). */
export function Eyebrow({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <ThemedText variant="label" color="muted" style={[{ letterSpacing: 1, textTransform: 'uppercase' }, style]}>
      {children}
    </ThemedText>
  )
}

interface SubHeaderProps {
  onBack: () => void
  backLabel?: string
  backIcon?: LucideIcon
  /** Chữ nhỏ ở giữa hàng (màn Tôi: "Tôi và cài đặt"). */
  title?: string
  right?: ReactNode
}

/** Hàng đầu màn con: nút back trái, tiêu đề nhỏ giữa (nếu có), khe phải. */
export function SubHeader({ onBack, backLabel = 'Quay lại', backIcon = ArrowLeft, title, right }: SubHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space[2] }}>
      <View style={{ width: 44, height: 44, justifyContent: 'center' }}>
        <IconButton icon={backIcon} accessibilityLabel={backLabel} onPress={onBack} color="primary" />
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <ThemedText variant="bodyStrong" accessibilityRole="header" numberOfLines={1}>
            {title}
          </ThemedText>
        ) : null}
      </View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right ?? null}</View>
    </View>
  )
}

/** Tiêu đề màn con (`.t1`) + dòng giải thích nhỏ. */
export function PageTitle({ title, sub, style }: { title: string; sub?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space[1] }, style]}>
      <ThemedText variant="titleLg" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30 }}>
        {title}
      </ThemedText>
      {sub ? (
        <ThemedText variant="body" color="muted">
          {sub}
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Tiêu đề lớn có vệt vàng (`.lt` + `.mark`): "Tiến độ" + "học tập". */
export function MarkTitle({ lead, mark, style }: { lead: string; mark: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2] }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${lead} ${mark}`}
    >
      <ThemedText variant="display">{lead}</ThemedText>
      <BrushMark>{mark}</BrushMark>
    </View>
  )
}

/** Đầu một nhóm nội dung (`.sec-h`): tiêu đề serif + chữ nhỏ bên phải. */
export function SectionHead({ title, right, style }: { title: string; right?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] }, style]}>
      <ThemedText variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </ThemedText>
      {right ? (
        <ThemedText variant="caption" color="muted">
          {right}
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Khung danh sách (`.list`): thẻ bo lớn, các hàng ngăn bằng đường kẻ trên. Bỏ qua phần tử null/false. */
export function RowList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme().colors
  const items = Children.toArray(children)
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' },
        style,
      ]}
    >
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  )
}

interface RowProps {
  title: string
  subtitle?: string
  glyph?: GlyphName
  /** Đầu hàng tự vẽ (chữ cái, số hạng…) thay cho ô glyph. */
  leading?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  tone?: 'neutral' | 'danger'
  showChevron?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  /** Nền nhấn nhẹ (hàng "Bạn" trên bảng xếp hạng). */
  highlighted?: boolean
}

/** Một hàng danh sách (`.li`): ô glyph 36pt, tên, mô tả, chevron khi bấm được. Cao tối thiểu 56pt. */
export function Row({
  title, subtitle, glyph, leading, trailing, onPress, tone = 'neutral', showChevron = true,
  accessibilityLabel, accessibilityHint, highlighted = false,
}: RowProps) {
  const c = useTheme().colors
  const danger = tone === 'danger'
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3] + 2,
        minHeight: 56,
        paddingVertical: 10,
        paddingHorizontal: space[4],
        backgroundColor: pressed ? c.surfaceSunken : highlighted ? c.accentSoft : 'transparent',
      }}
    >
      {leading ??
        (glyph ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: danger ? c.dangerSoft : c.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GaGlyph name={glyph} size={20} ink={danger ? 'danger' : 'primary'} gold={danger ? 'danger' : 'accent'} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText variant="body" color={danger ? 'danger' : 'primary'} style={{ fontFamily: fonts.bodyMedium }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="muted">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing ?? null}
      {onPress && showChevron && !danger ? <Icon icon={ChevronRight} size={18} color="faint" /> : null}
    </View>
  )

  if (!onPress) return body(false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  )
}

type BadgeTone = 'neutral' | 'success' | 'danger' | 'accent' | 'ink'

/** Nhãn viên thuốc nhỏ (`.badge`): xám, xanh, đỏ, vàng, mực. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const c = useTheme().colors
  const bg: Record<BadgeTone, string> = {
    neutral: c.surfaceSunken,
    success: c.successSoft,
    danger: c.dangerSoft,
    accent: c.accentSoft,
    ink: c.inkSurface,
  }
  const fg: Record<BadgeTone, 'secondary' | 'success' | 'danger' | 'primary' | 'onInk'> = {
    neutral: 'secondary',
    success: 'success',
    danger: 'danger',
    accent: 'primary',
    ink: 'onInk',
  }
  return (
    <View style={{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: bg[tone], justifyContent: 'center' }}>
      <ThemedText variant="caption" color={fg[tone]} style={{ fontFamily: fonts.bodyBold }} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  )
}

/** Thẻ phẳng (`.card`): nền surface, viền mảnh, bo 18pt. */
export function MeCard({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'sunken' | 'accent' }) {
  const c = useTheme().colors
  const bg = tone === 'sunken' ? c.surfaceSunken : tone === 'accent' ? c.accentSoft : c.surface
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: tone === 'surface' ? c.border : 'transparent',
          borderRadius: radius.lg,
          padding: space[4],
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
