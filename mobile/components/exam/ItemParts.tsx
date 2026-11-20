// Phần dùng chung của thẻ câu (tách khỏi `ExamTeilBody.tsx` 20/11/2026 để Lesen Teil 1 kiểu mới —
// `HeadlineMatch` — dùng lại): lời giải sau khi kiểm tra và cờ "đánh dấu xem lại" của thi thử.
// Không dùng hook ngoài `useTheme` — test dựng cây gọi thẳng `ItemExplanation` như hàm.

import { Pressable, View } from 'react-native'
import { Flag } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Caption, Icon, ThemedText } from '@/components/ui'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'

/** Phân tích một câu sau khi kiểm tra (như web): vì sao đúng, vì sao sai, bẫy, bằng chứng trong bài. */
export function ItemExplanation({ result }: { result: PracticeItemResult }) {
  const c = useTheme().colors
  const lines: { label: string; text: string }[] = []
  if (!result.isCorrect && result.whyWrong) lines.push({ label: 'Vì sao chưa đúng', text: result.whyWrong })
  if (result.whyRight) lines.push({ label: 'Vì sao đáp án đúng', text: result.whyRight })
  if (result.trap) lines.push({ label: 'Bẫy của câu', text: result.trap })
  if (result.rule) lines.push({ label: 'Quy tắc', text: result.rule })
  return (
    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
      <ThemedText variant="label" style={{ color: result.isCorrect ? c.success : c.danger }}>
        {result.isCorrect ? 'Đúng' : result.answered ? `Sai · đáp án đúng: ${result.correctText ?? result.correct}` : `Chưa trả lời · đáp án: ${result.correctText ?? result.correct}`}
      </ThemedText>
      {lines.map((l) => (
        <View key={l.label} style={{ gap: 2 }}>
          <Caption>{l.label}</Caption>
          <ThemedText variant="body" color="secondary">{l.text}</ThemedText>
        </View>
      ))}
      {result.evidence.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Caption>Bằng chứng trong bài</Caption>
          {result.evidence.map((e, i) => (
            <ThemedText key={i} variant="body" accessibilityLanguage="de-DE" style={{ backgroundColor: c.accentSoft }}>
              „{e}“
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** Cờ "đánh dấu xem lại" của một câu thi thử (mẫu `mockrun`): bật thì nền vàng nhạt, viền cam. */
export function FlagToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu xem lại'}
      accessibilityState={{ selected: on }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.orange : colors.border,
        backgroundColor: on ? colors.accentSoft : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon icon={Flag} size={18} color={on ? 'primary' : 'muted'} />
    </Pressable>
  )
}
