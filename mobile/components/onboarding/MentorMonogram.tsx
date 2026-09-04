// Avatar mentor kiểu monogram (Galerie v2): chữ cái đầu bằng serif vàng trên ô
// mực sắc cạnh — thay avatar emoji cũ theo hướng icon-system v2 (bỏ emoji).

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { fonts, radius, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { mentorFirstName, type OnboardingMentor } from '@/lib/onboardingMentor'

interface MentorMonogramProps {
  mentor: OnboardingMentor | null
  size?: number
  style?: StyleProp<ViewStyle>
}

export function MentorMonogram({ mentor, size = 56, style }: MentorMonogramProps) {
  const c = useTheme().colors
  const letter = mentorFirstName(mentor).charAt(0).toUpperCase()
  return (
    <View
      accessible
      accessibilityLabel={`Mentor ${mentorFirstName(mentor)}`}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: c.inkSurface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <ThemedText
        style={{
          fontFamily: fonts.displaySemi,
          fontSize: Math.round(size * 0.48),
          lineHeight: Math.round(size * 0.62),
          color: c.accent,
        }}
      >
        {letter}
      </ThemedText>
    </View>
  )
}
