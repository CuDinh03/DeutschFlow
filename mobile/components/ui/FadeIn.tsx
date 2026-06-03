// Lightweight enter animation: fade + slight rise. Wrap a screen section and pass
// an increasing `delay` to stagger sections on mount. Keep this at the section
// level — wrapping individual flex-grid items reparents them and breaks width %.

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { MotiView } from 'moti'
import { motion } from '@/lib/theme'

interface FadeInProps {
  children: ReactNode
  delay?: number
  distance?: number
  style?: StyleProp<ViewStyle>
}

export function FadeIn({ children, delay = 0, distance = 10, style }: FadeInProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: distance }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: motion.duration.normal, delay }}
      style={style}
    >
      {children}
    </MotiView>
  )
}
