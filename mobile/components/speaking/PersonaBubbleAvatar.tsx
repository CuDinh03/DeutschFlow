// Small circular chat avatar — crops the persona character to a head-shot.
// The character viewBox is 280×500 (full body); we render it oversized and offset
// upward inside a clipped circle so only the head shows.

import { View } from 'react-native'
import { useTheme } from '@/lib/theme'
import type { PersonaId } from '@/lib/personas'
import { PersonaAvatar } from './PersonaAvatar'

interface PersonaBubbleAvatarProps {
  personaId: PersonaId
  size?: number
  expression?: string
  isTalking?: boolean
  ringColor?: string
  /** Stop the idle-blink timer — use for static history avatars in long chats. */
  paused?: boolean
}

export function PersonaBubbleAvatar({
  personaId,
  size = 36,
  expression = 'neutral',
  isTalking = false,
  ringColor,
  paused = false,
}: PersonaBubbleAvatarProps) {
  const theme = useTheme()
  const charW = size * 1.5
  const charH = charW * (500 / 280)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: ringColor ? 2 : 1,
        borderColor: ringColor ?? theme.colors.border,
        alignItems: 'center',
      }}
    >
      <View style={{ width: charW, height: charH, marginTop: -size * 0.42 }}>
        <PersonaAvatar personaId={personaId} expression={expression} isTalking={isTalking} paused={paused} />
      </View>
    </View>
  )
}
