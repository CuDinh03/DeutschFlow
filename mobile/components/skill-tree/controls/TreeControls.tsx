// On-canvas chrome for the tree: zoom +/- buttons and a "Toàn cảnh" fit button.
// These are RN overlays OUTSIDE the <Svg> (spec §5). They drive the shared-value
// transform via the callbacks from useTreeGestures, so they never re-render the SVG.

import { Fragment } from 'react'
import { Pressable, View } from 'react-native'
import { Locate, Maximize, Minus, Plus, Share2 } from 'lucide-react-native'
import { Button, IconButton, ThemedText } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import type { MilestoneState } from '../layout'

export function ZoomButtons({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        borderRadius: radius.full,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}
    >
      <IconButton icon={Plus} accessibilityLabel="Phóng to" onPress={onZoomIn} size={22} />
      <View style={{ height: 1, backgroundColor: c.border }} />
      <IconButton icon={Minus} accessibilityLabel="Thu nhỏ" onPress={onZoomOut} size={22} />
    </View>
  )
}

export function FitButton({ onFit }: { onFit: () => void }) {
  return (
    <Button
      label="Toàn cảnh"
      icon={Maximize}
      variant="secondary"
      size="sm"
      fullWidth={false}
      onPress={onFit}
      style={{ paddingHorizontal: space[3] }}
    />
  )
}

export function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <Button
      label="Khoe cây"
      icon={Share2}
      variant="primary"
      size="sm"
      fullWidth={false}
      onPress={onShare}
      style={{ paddingHorizontal: space[3] }}
    />
  )
}

// "Về bài đang học" — recentres the viewport on the recommended next lesson so learners
// can jump back to the frontier from anywhere on the canvas. Rendered only when one exists.
export function FocusButton({ onFocus }: { onFocus: () => void }) {
  return (
    <Button
      label="Bài đang học"
      icon={Locate}
      variant="secondary"
      size="sm"
      fullWidth={false}
      onPress={onFocus}
      style={{ paddingHorizontal: space[3] }}
    />
  )
}

export interface RailLevel {
  level: string
  state: MilestoneState
}

// Vertical CEFR rail for quick jumps between levels. Ordered top→bottom = highest→lowest to
// match the bottom-up canvas (goal/crown at the top, ground/A1 at the bottom).
export function LevelRail({ levels, onJump }: { levels: RailLevel[]; onJump: (level: string) => void }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        borderRadius: radius.full,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}
    >
      {levels.map((l, i) => (
        <Fragment key={l.level}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Nhảy tới cấp ${l.level}`}
            onPress={() => onJump(l.level)}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <ThemedText variant="label" style={{ color: l.state === 'locked' ? c.textFaint : c.textPrimary }}>
              {l.level}
            </ThemedText>
          </Pressable>
        </Fragment>
      ))}
    </View>
  )
}
