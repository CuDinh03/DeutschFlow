// On-canvas chrome for the tree: zoom +/- buttons and a "Toàn cảnh" fit button.
// These are RN overlays OUTSIDE the <Svg> (spec §5). They drive the shared-value
// transform via the callbacks from useTreeGestures, so they never re-render the SVG.

import { View } from 'react-native'
import { Maximize, Minus, Plus, Share2 } from 'lucide-react-native'
import { Button, IconButton } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'

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
