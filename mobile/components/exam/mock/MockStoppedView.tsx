// Kết quả "Dừng giữa chừng" của thi thử (Đợt 4e, 20/11/2026) — như web: không tính đỗ/trượt, các Teil
// đã làm được chấm theo Teil, bài viết dở không chấm. Dữ liệu lấy thẳng từ thân trả về của `/stop`.

import { View } from 'react-native'
import { space, useTheme, radius } from '@/lib/theme'
import { Button, Card, GaGlyph, ThemedText } from '@/components/ui'
import { stoppedRows, stoppedSummary, type StopResult } from '@/lib/mockStop'

export function MockStoppedView({ result, title, onBack }: { result: StopResult; title: string; onBack: () => void }) {
  const c = useTheme().colors
  const rows = stoppedRows(result)
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }} accessible accessibilityRole="header">
        <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>{title}</ThemedText>
        <ThemedText variant="display">Đã dừng giữa chừng</ThemedText>
        <ThemedText variant="body" color="secondary">{stoppedSummary(result)}</ThemedText>
      </View>

      <View style={{ flexDirection: 'row', gap: space[3], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
        <GaGlyph name="thithu" size={18} />
        <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
          Lượt dừng giữa chừng không tính đỗ hay trượt. Teil đã làm được chấm riêng; bài viết dở không được chấm. Lượt này nằm trong lịch sử thi với nhãn “Dừng giữa chừng”.
        </ThemedText>
      </View>

      {rows.length > 0 ? (
        <Card style={{ paddingVertical: space[1] }}>
          {rows.map((r, i) => (
            <View
              key={r.key || String(i)}
              accessible
              accessibilityLabel={`${r.name}: ${r.value}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                minHeight: 44,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <ThemedText variant="bodyStrong" style={{ flex: 1 }} accessibilityLanguage="de-DE">{r.name}</ThemedText>
              <ThemedText variant="caption" style={{ color: r.counted ? c.textPrimary : c.textMuted, fontVariant: ['tabular-nums'] }}>
                {r.value}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="Về màn Đề" onPress={onBack} />
    </View>
  )
}
