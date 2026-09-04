import { memo } from 'react'
import { View, Pressable } from 'react-native'
import { MotiView } from 'moti'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Pill } from '@/components/ui'
import { RevealText } from '@/components/speaking/RevealText'
import { PersonaBubbleAvatar } from '@/components/speaking/PersonaBubbleAvatar'
import { usableSuggestions, type ChatTurn } from '@/lib/speakingChat'
import type { PersonaId } from '@/lib/personas'

export const MessageBubble = memo(function MessageBubble({
  turn,
  personaId,
  active = false,
  onUseSuggestion,
  onRetry,
}: {
  turn: ChatTurn
  personaId: PersonaId
  active?: boolean
  onUseSuggestion?: (text: string) => void
  /** MB-3: có mặt khi user turn ở trạng thái 'failed' — bấm để gửi lại (giữ nguyên câu). */
  onRetry?: () => void
}) {
  const { colors } = useTheme()
  const isUser = turn.role === 'user'
  const fb = turn.feedback
  // Correction belongs to what the LEARNER said → render under the user bubble.
  // Suggestions answer the AI's latest question → render under the assistant bubble.
  const showCorrection = isUser && !!fb?.correction
  // Wire NON_NULL: suggestion có thể thiếu germanText (LLM bỏ trống) — lọc trước khi render,
  // chip "💡 " rỗng vừa vô nghĩa vừa là đường đưa undefined vào typewriter (RedBox 04/09).
  const suggestions = !isUser ? usableSuggestions(fb?.suggestions) : []

  const inner = (
    <View style={{ flex: isUser ? undefined : 1, alignItems: isUser ? 'flex-end' : 'flex-start', gap: space[2] }}>
      <View
        style={{
          maxWidth: '92%',
          backgroundColor: isUser ? colors.accent : colors.surfaceElevated,
          borderRadius: radius.lg,
          borderBottomRightRadius: isUser ? radius.sm : radius.lg,
          borderBottomLeftRadius: isUser ? radius.lg : radius.sm,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        }}
      >
        {isUser ? (
          <ThemedText variant="body" color="onAccent">
            {turn.content}
          </ThemedText>
        ) : (
          <RevealText text={turn.content} active={active} variant="body" color="primary" />
        )}
      </View>

      {isUser && turn.status === 'failed' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gửi lại câu trả lời"
          onPress={onRetry}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], paddingTop: space[1] }}
        >
          <ThemedText variant="caption" color="danger">
            Gửi lỗi · Chạm để gửi lại
          </ThemedText>
        </Pressable>
      ) : null}

      {showCorrection ? (
        <View style={{ maxWidth: '92%' }}>
          <View
            style={{
              backgroundColor: colors.successSoft,
              borderRadius: radius.md,
              borderLeftWidth: 3,
              borderLeftColor: colors.success,
              paddingHorizontal: space[3],
              paddingVertical: space[3],
              gap: space[2],
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}
            >
              <ThemedText variant="label" color="success">
                ✍️ Nên nói
              </ThemedText>
              {fb?.grammarPoint ? <Pill label={fb.grammarPoint} tone="success" /> : null}
            </View>
            <ThemedText variant="bodyStrong" color="primary">
              {fb?.correction}
            </ThemedText>
            {fb?.explanationVi ? (
              <ThemedText variant="caption" color="muted">
                {fb.explanationVi}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <View style={{ maxWidth: '92%', gap: space[2] }}>
          {suggestions.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => {
                // usableSuggestions đã lọc, nhưng TS không narrow qua filter — guard tại chỗ.
                const text = s.germanText
                if (text) onUseSuggestion?.(text)
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                backgroundColor: colors.infoSoft,
                borderRadius: radius.sm,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
              }}
            >
              <ThemedText variant="caption" color="info" style={{ flex: 1 }}>
                💡 {s.germanText}
              </ThemedText>
              <ThemedText variant="label" color="info">
                Dùng →
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
    >
      {isUser ? (
        inner
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <PersonaBubbleAvatar personaId={personaId} size={36} paused />
          {inner}
        </View>
      )}
    </MotiView>
  )
})
