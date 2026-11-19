// Linh kiện trình bày dùng chung cho nhóm màn Lớp học · Tin nhắn · Thông báo theo mẫu v3.4
// (Đợt 6B, 19/11/2026): thanh đầu màn, tiêu đề có vệt vàng, khối danh sách ngăn vạch, nhãn trạng
// thái viên thuốc, bộ ba số liệu, ô ngày, ô chữ cái đầu, chip. Chỉ trình bày — không gọi API.

import type { ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { BrushMark, IconButton, ThemedText } from '@/components/ui'
import type { GlyphName } from '@/lib/galerieGlyphs'

/** Vùng chừa bằng nút back (44pt) để tiêu đề giữa luôn nằm chính giữa. */
const SIDE_SLOT = 44

/**
 * Hàng đầu màn: nút quay lại · (tiêu đề nhỏ ở giữa + dòng phụ) · khe phải.
 * Không có tiêu đề giữa thì khe phải đẩy sát lề phải (màn có tiêu đề lớn bên dưới).
 */
export function TopBar({
  onBack, title, subtitle, right, backLabel = 'Quay lại',
}: {
  onBack: () => void
  title?: string
  subtitle?: string
  right?: ReactNode
  backLabel?: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[5],
        paddingTop: space[2],
        minHeight: SIDE_SLOT + space[2],
      }}
    >
      <View style={{ width: SIDE_SLOT, height: SIDE_SLOT, justifyContent: 'center' }}>
        <IconButton icon={ArrowLeft} accessibilityLabel={backLabel} color="primary" onPress={onBack} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }} accessible={!!title} accessibilityRole={title ? 'header' : undefined}>
        {title ? (
          <ThemedText variant="label" numberOfLines={1} style={{ fontSize: 14 }}>
            {title}
          </ThemedText>
        ) : null}
        {subtitle ? (
          <ThemedText variant="caption" color="muted" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={{ minWidth: SIDE_SLOT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space[1] }}>
        {right ?? null}
      </View>
    </View>
  )
}

/** Nút tròn 44pt có viền ở khe phải của thanh đầu màn (`.iconbtn`), mang glyph Galerie. */
export function HeaderGlyphButton({
  glyph, accessibilityLabel, onPress,
}: {
  glyph: GlyphName
  accessibilityLabel: string
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <IconButton
      glyph={glyph}
      size={20}
      color="primary"
      hitSlop={0}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        width: SIDE_SLOT,
        height: SIDE_SLOT,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  )
}

/** Tiêu đề lớn kiểu `.lt`: phần thường + phần có vệt vàng (`.mark`). */
export function MarkTitle({ plain, mark, style }: { plain: string; mark: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space[2] }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${plain} ${mark}`}
    >
      <ThemedText variant="display">{plain}</ThemedText>
      <BrushMark>{mark}</BrushMark>
    </View>
  )
}

/** Eyebrow chữ hoa giãn (`.eyebrow`). */
export function Eyebrow({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 11.5 }}>
        {children}
      </ThemedText>
    </View>
  )
}

/** Tiêu đề mục kiểu `.sec-h .t2` (serif 18–19). */
export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText variant="title" accessibilityRole="header" style={{ marginTop: space[6], marginBottom: space[3] }}>
      {children}
    </ThemedText>
  )
}

/** Khối danh sách `.list`: nền thẻ, viền mảnh, bo góc, cắt tràn. */
export function ListBlock({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme().colors
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** Kiểu một dòng `.li` trong khối danh sách. Dòng đầu không có vạch trên. */
export function listRowStyle(
  border: string,
  first: boolean,
  extra?: ViewStyle,
): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
    minHeight: 56,
    paddingHorizontal: space[4],
    paddingVertical: space[2] + 2,
    borderTopWidth: first ? 0 : 1,
    borderTopColor: border,
    ...extra,
  }
}

export type BadgeTone = 'neutral' | 'danger' | 'success' | 'accent' | 'info' | 'ink'

/** Nhãn trạng thái viên thuốc `.badge` (cao 24, chữ 12 đậm, không viết hoa). */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const c = useTheme().colors
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: c.surfaceSunken, fg: c.textSecondary },
    danger: { bg: c.dangerSoft, fg: c.danger },
    success: { bg: c.successSoft, fg: c.success },
    accent: { bg: c.accentSoft, fg: c.textPrimary },
    info: { bg: c.infoSoft, fg: c.info },
    ink: { bg: c.inkSurface, fg: c.onInk },
  }
  const t = map[tone]
  return (
    <View
      style={{
        height: 24,
        paddingHorizontal: space[2] + 2,
        borderRadius: radius.full,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        flexShrink: 0,
      }}
    >
      <ThemedText variant="caption" numberOfLines={1} style={{ color: t.fg, fontFamily: fonts.bodyBold }}>
        {label}
      </ThemedText>
    </View>
  )
}

export interface StatCell {
  value: string
  label: string
  tone?: 'danger'
}

/** Bộ ba số liệu `.cstats`: số serif lớn + nhãn nhỏ. */
export function StatTriplet({ cells, style }: { cells: StatCell[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', gap: space[2] }, style]}>
      {cells.map((s) => (
        <View
          key={s.label}
          style={{ flex: 1, minWidth: 0 }}
          accessible
          accessibilityLabel={`${s.label}: ${s.value}`}
        >
          <ThemedText variant="titleLg" color={s.tone === 'danger' ? 'danger' : 'primary'} style={{ fontVariant: ['tabular-nums'] }}>
            {s.value}
          </ThemedText>
          <ThemedText variant="caption" color="muted" numberOfLines={1}>
            {s.label}
          </ThemedText>
        </View>
      ))}
    </View>
  )
}

/** Ô tròn chữ cái đầu `.mono` (mặc định nền mực). */
export function InitialAvatar({ initial, size = 44, tone = 'ink' }: { initial: string; size?: number; tone?: 'ink' | 'soft' }) {
  const c = useTheme().colors
  const ink = tone === 'ink'
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: ink ? c.inkSurface : c.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <ThemedText variant="title" style={{ color: ink ? c.onInk : c.textPrimary, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5) }}>
        {initial}
      </ThemedText>
    </View>
  )
}

/** Chip `.chip` (cao 36, viên thuốc). `on` = nền mực chữ trắng. Vùng chạm ≥ 44pt nhờ hitSlop. */
export function Chip({
  label, onPress, on, accessibilityLabel, selectable = false, leading, disabled,
}: {
  label: string
  onPress: () => void
  on?: boolean
  accessibilityLabel?: string
  /** Chip lọc/tab: báo `selected` cho trình đọc màn hình. Chip hành động thì bỏ qua. */
  selectable?: boolean
  leading?: ReactNode
  disabled?: boolean
}) {
  const c = useTheme().colors
  return (
    <Pressable
      accessibilityRole={selectable ? 'tab' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selectable ? { selected: !!on, disabled: !!disabled } : { disabled: !!disabled }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: space[3] + 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: on ? c.inkSurface : c.border,
        backgroundColor: on ? c.inkSurface : c.surfaceSunken,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1] + 2,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {leading ?? null}
      <ThemedText variant="label" style={{ color: on ? c.onInk : c.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}
