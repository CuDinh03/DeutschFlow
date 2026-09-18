import { View } from 'react-native'
import { Check } from 'lucide-react-native'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { fonts, radius, space, useTheme } from '@/lib/theme'
import { Caption, GaGlyph, Icon, SelectableChip, ThemedText } from '@/components/ui'

// Khối dựng dùng chung của wizard onboarding (Đợt 5, 17/09/2026): tách khỏi app/(auth)/onboarding.tsx
// để bản rút gọn cho học viên trung tâm (OrgLiteWizard) dùng lại đúng ô/chip/tiêu đề của wizard
// đầy đủ thay vì chép — và để file màn hình chính không phình quá 800 dòng. Thuần trình diễn.

// Current level feeds the Platform × Level matrix; A0 = absolute beginner.
// v2: A0 được CHỌN SẴN — đường mặc định phải tường minh, không còn lớp "chưa
// chạm hàng chip" mơ hồ từng che bug F-1 (QA 2026-08-20).
export const CURRENT_LEVELS: { value: string; label: string }[] = [
  { value: 'A0', label: 'Mới bắt đầu · A0' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
]

// Daily study goal (minutes) — the streak anchor.
export const DAILY_GOALS: { value: string; tag: string }[] = [
  { value: '5', tag: 'Tranh thủ' },
  { value: '10', tag: 'Nhẹ nhàng' },
  { value: '15', tag: 'Đều đặn' },
  { value: '20', tag: 'Nghiêm túc' },
]

export const DEFAULT_SESSIONS_PER_WEEK = 5
export const DEFAULT_MINUTES_PER_SESSION = 15


export function TitleBlock({ cap, title, sub }: { cap: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: space[2] }}>
      <Caption>{cap}</Caption>
      <ThemedText variant="display">{title}</ThemedText>
      {sub ? (
        <ThemedText variant="body" color="secondary">
          {sub}
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Chấm radio Galerie: vòng hairline → đĩa gold + check trắng khi chọn. */
export function RadioDot({ selected, color }: { selected: boolean; color?: 'accent' | 'success' }) {
  const c = useTheme().colors
  const fill = color === 'success' ? c.success : c.accentText
  return (
    <View
      style={{
        width: 21,
        height: 21,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: selected ? fill : c.border,
        backgroundColor: selected ? fill : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon icon={Check} size={12} color="onInk" strokeWidth={3.2} /> : null}
    </View>
  )
}

/** Ô icon 40px nền giấy chìm (hoặc mực khi selected) cho các hàng/tile. */
export function IconTile({ glyph, selected = false, size = 40 }: { glyph: GlyphName; selected?: boolean; size?: number }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: selected ? c.inkSurface : c.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GaGlyph name={glyph} size={Math.round(size * 0.5)} ink={selected ? 'onInk' : 'secondary'} />
    </View>
  )
}

export function OptionTile({
  label,
  desc,
  glyph,
  selected,
  onPress,
}: {
  label: string
  desc: string
  glyph: GlyphName
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={`${label} — ${desc}`}
      selected={selected}
      onPress={onPress}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: space[2],
        padding: space[3] + 2,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <IconTile glyph={glyph} selected={selected} size={38} />
        <RadioDot selected={selected} />
      </View>
      <View style={{ gap: 2 }}>
        <ThemedText style={{ fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 20 }}>{label}</ThemedText>
        <ThemedText variant="caption" color="secondary">
          {desc}
        </ThemedText>
      </View>
    </SelectableChip>
  )
}

export function LevelChips({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[]
  selected: string | null
  onSelect: (value: string) => void
}) {
  const c = useTheme().colors
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((opt) => {
        const active = selected === opt.value
        return (
          <SelectableChip
            key={opt.value}
            label={opt.label}
            selected={active}
            onPress={() => onSelect(opt.value)}
            style={{
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? c.accentText : c.border,
              backgroundColor: active ? c.accentSoft : c.surface,
            }}
          >
            <ThemedText variant="bodyStrong" color={active ? 'primary' : 'secondary'}>
              {opt.label}
            </ThemedText>
          </SelectableChip>
        )
      })}
    </View>
  )
}

export function MinuteTile({
  minutes,
  tag,
  selected,
  onPress,
}: {
  minutes: string
  tag: string
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={`${minutes} phút mỗi ngày — ${tag}`}
      selected={selected}
      onPress={onPress}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: space[1],
        padding: space[4],
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
          <ThemedText variant="monoLg">{minutes}</ThemedText>
          <ThemedText variant="caption" color="secondary">
            phút
          </ThemedText>
        </View>
        {selected ? <RadioDot selected /> : null}
      </View>
      <ThemedText variant="caption" color={selected ? 'primary' : 'secondary'}>
        {tag}
      </ThemedText>
    </SelectableChip>
  )
}
