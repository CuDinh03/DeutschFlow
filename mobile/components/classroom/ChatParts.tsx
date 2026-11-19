// Bong bóng, vạch ngày và ô nhập của khung chat theo mẫu v3.4 (`.bub`, `.daysep`, `.composer`),
// dùng chung cho Chat lớp và Nhắn với giáo viên (Đợt 6B, 19/11/2026). CHỈ trình bày: mọi hành vi
// (gửi, gửi lại, giữ để báo cáo/xoá) do màn truyền vào qua callback, không đổi ở đây.

import { Pressable, TextInput, View } from 'react-native'
import { Send } from 'lucide-react-native'
import { fonts, radius, space, themeShadowStyle, useTheme } from '@/lib/theme'
import { Icon, ThemedText } from '@/components/ui'

/** Vạch ngày ở giữa khung chat ("Hôm nay", "Hôm qua", "14/11"). */
export function DaySeparator({ label }: { label: string }) {
  const c = useTheme().colors
  return (
    <View style={{ alignItems: 'center', marginVertical: space[2] }} accessibilityRole="header">
      <View style={{ paddingHorizontal: space[2] + 2, paddingVertical: 2, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}>
        <ThemedText variant="caption" color="muted" style={{ fontFamily: fonts.bodySemi, fontSize: 11.5 }}>
          {label}
        </ThemedText>
      </View>
    </View>
  )
}

export interface BubbleViewProps {
  mine: boolean
  /** Dòng nhỏ trên nội dung: "Cô Thu Hà · 08:12", "Bạn · 08:31", "Bạn · Đang gửi…". */
  meta: string
  body: string
  deleted?: boolean
  sending?: boolean
  failed?: boolean
  onPress?: () => void
  onLongPress?: () => void
  delayLongPress?: number
  accessibilityLabel?: string
}

/** Một bong bóng: của mình = nền mực chữ sáng, đuôi góc dưới phải; người khác = nền thẻ có viền. */
export function BubbleView({
  mine, meta, body, deleted, sending, failed, onPress, onLongPress, delayLongPress, accessibilityLabel,
}: BubbleViewProps) {
  const c = useTheme().colors
  const inkBubble = mine && !deleted
  const metaColor = inkBubble ? c.onInkMuted : c.textMuted
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: space[2] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        accessibilityRole={onPress || onLongPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        style={{
          maxWidth: '84%',
          opacity: sending ? 0.65 : 1,
          backgroundColor: deleted ? c.surfaceSunken : inkBubble ? c.inkSurface : c.surface,
          borderWidth: 1,
          borderColor: inkBubble ? c.inkSurface : c.border,
          borderRadius: radius.lg - 2,
          borderBottomRightRadius: mine ? 6 : radius.lg - 2,
          borderBottomLeftRadius: mine ? radius.lg - 2 : 6,
          paddingHorizontal: space[3],
          paddingVertical: space[2] + 1,
          gap: 2,
        }}
      >
        <ThemedText variant="caption" numberOfLines={1} style={{ color: metaColor, fontSize: 11.5 }}>
          {meta}
        </ThemedText>
        {deleted ? (
          <ThemedText variant="body" color="faint" style={{ fontStyle: 'italic' }}>
            Tin đã xoá
          </ThemedText>
        ) : (
          <ThemedText variant="body" style={{ color: inkBubble ? c.onInk : c.textPrimary }}>
            {body}
          </ThemedText>
        )}
      </Pressable>
      {failed ? (
        <ThemedText variant="caption" color="danger" style={{ marginTop: 2, paddingHorizontal: space[1] }}>
          Gửi lỗi · Chạm để thử lại
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Ô nhập viên thuốc nổi + nút gửi tròn vàng (`.composer`). */
export function ChatComposer({
  value, onChangeText, placeholder, canSend, onSend, bottomInset, hint,
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  canSend: boolean
  onSend: () => void
  bottomInset: number
  /** Dòng nhỏ dưới ô nhập (ví dụ hướng dẫn giữ tin để báo cáo). */
  hint?: string
}) {
  const theme = useTheme()
  const c = theme.colors
  return (
    <View style={{ paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: Math.max(bottomInset, space[2]), backgroundColor: c.bg }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space[2],
            paddingLeft: space[4],
            paddingRight: 6,
            paddingVertical: 6,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
          },
          themeShadowStyle(theme.shadow.card),
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          multiline
          accessibilityLabel="Nội dung tin nhắn"
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            paddingTop: 11,
            paddingBottom: 11,
            color: c.textPrimary,
            fontFamily: fonts.bodyRegular,
            fontSize: 16,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gửi tin nhắn"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: canSend ? c.accent : c.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <Icon icon={Send} size={18} color={canSend ? 'onAccent' : 'faint'} />
        </Pressable>
      </View>
      {hint ? (
        <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[2] }}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  )
}
