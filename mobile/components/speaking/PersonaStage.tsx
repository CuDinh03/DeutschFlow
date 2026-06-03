// Persona "stage" shown atop the chat. Reflects the live interaction state through
// the character's expression + a status line: listening / thinking / speaking and
// the transient reactions praise / approve / wrong / off-topic.

import { View } from 'react-native'
import { MotiView } from 'moti'
import { PERSONA_TOKENS, type PersonaId } from '@/lib/personas'
import { space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { PersonaBubbleAvatar } from './PersonaBubbleAvatar'

export type StageState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type Reaction = 'praise' | 'approve' | 'wrong' | 'offtopic' | null

interface PersonaStageProps {
  personaId: PersonaId
  stage: StageState
  reaction: Reaction
}

export function PersonaStage({ personaId, stage, reaction }: PersonaStageProps) {
  const theme = useTheme()
  const c = theme.colors
  const token = PERSONA_TOKENS[personaId]

  const expression =
    reaction === 'praise' ? 'laughing'
      : reaction === 'approve' ? 'smiling'
        : reaction === 'wrong' ? 'serious'
          : reaction === 'offtopic' ? 'thinking'
            : stage === 'thinking' ? 'thinking'
              : 'neutral'
  const isTalking = stage === 'speaking' && !reaction

  const { label, color } =
    reaction === 'praise' ? { label: 'Sehr gut! 🎉', color: c.success }
      : reaction === 'approve' ? { label: 'Chính xác ✓', color: c.success }
        : reaction === 'wrong' ? { label: 'Cùng sửa nhé ✍️', color: c.danger }
          : reaction === 'offtopic' ? { label: 'Quay lại chủ đề nhé 🙂', color: c.info }
            : stage === 'listening' ? { label: 'Đang nghe…', color: c.danger }
              : stage === 'thinking' ? { label: 'Đang suy nghĩ…', color: c.textMuted }
                : stage === 'speaking' ? { label: 'Đang nói…', color: c.accentText }
                  : { label: token.role, color: c.textMuted }

  const ring = stage === 'listening' ? c.danger : reaction ? color : token.accent

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[5],
        paddingVertical: space[3],
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View>
        {stage === 'listening' ? (
          <MotiView
            from={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.7 }}
            transition={{ loop: true, type: 'timing', duration: 1100 }}
            style={{
              position: 'absolute',
              top: -6,
              left: -6,
              right: -6,
              bottom: -6,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: c.danger,
            }}
          />
        ) : null}
        <PersonaBubbleAvatar
          personaId={personaId}
          size={56}
          expression={expression}
          isTalking={isTalking}
          ringColor={ring}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {token.name}
        </ThemedText>
        <ThemedText variant="caption" style={{ color }} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>

      {stage === 'thinking' ? <TypingDots color={c.textMuted} /> : null}
    </View>
  )
}

function TypingDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          from={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 500, delay: i * 150 }}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
        />
      ))}
    </View>
  )
}
