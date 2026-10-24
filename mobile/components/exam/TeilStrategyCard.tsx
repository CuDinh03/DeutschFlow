import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { useTeilStrategy } from '@/lib/examStrategy'

/**
 * Chiến thuật một Teil (LT2, 22/10/2026) — bản sinh đôi của
 * `frontend/src/components/exam/strategy/TeilStrategy.tsx`. Thu gọn mặc định để không chiếm giờ làm
 * bài; chưa duyệt thì học viên thấy "sắp có", admin/giáo viên thấy bản nháp kèm nhãn.
 */
export function TeilStrategyCard({
  provider,
  level,
  section,
  teil,
  summaryLabel,
  hideComingSoon = false,
}: {
  provider?: string
  level?: string
  section: string
  teil?: number
  summaryLabel?: string
  hideComingSoon?: boolean
}) {
  const { colors: c } = useTheme()
  const [open, setOpen] = useState(false)
  const strategy = useTeilStrategy(provider, level, section, teil)

  if (!strategy) return null
  if (strategy.status === 'COMING_SOON' || !strategy.content) {
    if (hideComingSoon) return null
    return (
      <ThemedText variant="caption" color="muted">
        Chiến thuật cho Teil này: sắp có.
      </ThemedText>
    )
  }

  const content = strategy.content
  const label = summaryLabel ?? 'Chiến thuật cho Teil này'
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        hitSlop={4}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2] }}
      >
        {open ? <ChevronUp size={16} color={c.textSecondary} /> : <ChevronDown size={16} color={c.textSecondary} />}
        <ThemedText variant="label" style={{ flex: 1 }}>
          {label}
        </ThemedText>
        {strategy.status === 'DRAFT' ? (
          <ThemedText variant="caption" style={{ color: c.textSecondary }}>
            Nháp — chưa duyệt
          </ThemedText>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ gap: space[3], paddingHorizontal: space[3], paddingBottom: space[3] }}>
          <View style={{ gap: space[1] }}>
            <ThemedText variant="bodyStrong">{content.title}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {content.format}
            </ThemedText>
          </View>
          <Section title="Các bước làm" lines={content.steps.map((s, i) => `${i + 1}. ${s}`)} />
          <Section title="Bẫy hay gặp" lines={content.traps.map((s) => `• ${s}`)} />
          <Section title="Mất điểm vì… → chữa bằng…" lines={content.fixes.map((f) => `${f.cause} → ${f.fix}`)} />
        </View>
      ) : null}
    </View>
  )
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={{ gap: space[1] }}>
      <ThemedText variant="label" color="muted">
        {title}
      </ThemedText>
      {lines.map((line) => (
        <ThemedText key={line} variant="caption">
          {line}
        </ThemedText>
      ))}
    </View>
  )
}
