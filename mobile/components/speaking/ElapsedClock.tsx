// Đồng hồ buổi nói đếm lên (mẫu v3.4 `speakchat`, Đợt 5 phần C). Tự tick mỗi giây, chỉ đọc mốc bắt đầu.

import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { formatElapsed } from '@/lib/speakingChat'

export function ElapsedClock({ startedAt }: { startedAt: number | null }) {
  const c = useTheme().colors
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt == null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  if (startedAt == null) return null
  const text = formatElapsed(now - startedAt)
  return (
    <View
      accessible
      accessibilityLabel={`Thời gian buổi nói ${text}`}
      style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}
    >
      <ThemedText variant="mono">{text}</ThemedText>
    </View>
  )
}
