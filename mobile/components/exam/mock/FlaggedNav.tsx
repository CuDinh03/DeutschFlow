// "Câu đánh dấu (N)" của màn đang thi thử (mẫu v3.4 `mockrun`, Đợt 4e 20/11/2026) — như web `FlaggedNav`:
// bấm mở danh sách câu đã đánh dấu trong chặng đang thi, bấm một câu để cuộn tới câu đó.

import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { ChevronRight, Flag } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Icon, ThemedText } from '@/components/ui'
import type { FlaggedEntry } from '@/lib/mockFlags'

export function FlaggedNav({ entries, onJump }: { entries: FlaggedEntry[]; onJump: (id: string) => void }) {
  const c = useTheme().colors
  const [open, setOpen] = useState(false)
  const count = entries.length
  const expanded = open && count > 0
  return (
    <View style={{ gap: space[2] }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        disabled={count === 0}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Câu đánh dấu, ${count} câu` : 'Chưa có câu đánh dấu'}
        accessibilityState={{ expanded, disabled: count === 0 }}
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 32,
          paddingHorizontal: space[3],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: count > 0 ? c.orange : c.border,
          backgroundColor: count > 0 ? c.accentSoft : c.surface,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon icon={Flag} size={15} color={count > 0 ? 'primary' : 'muted'} />
        <ThemedText variant="caption" style={{ color: count > 0 ? c.textPrimary : c.textMuted, fontVariant: ['tabular-nums'] }}>
          {`Câu đánh dấu (${count})`}
        </ThemedText>
      </Pressable>

      {expanded ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface }}>
          {entries.map((e, i) => (
            <Pressable
              key={e.id}
              onPress={() => {
                setOpen(false)
                onJump(e.id)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${e.label}, ${e.teil}`}
              accessibilityHint="Tới câu này"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                minHeight: 44,
                paddingHorizontal: space[3],
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ThemedText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }} accessibilityLanguage="de-DE">{e.label}</ThemedText>
              <ThemedText variant="caption" color="muted" accessibilityLanguage="de-DE">{e.teil}</ThemedText>
              <Icon icon={ChevronRight} size={16} color="muted" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}
