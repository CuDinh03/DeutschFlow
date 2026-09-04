// Bản STATE của useBlurGuard.focusedRef: trả boolean re-render theo focus/blur, cho chỗ cần
// ĐỔI RENDER khi màn ẩn sau tab khác (Tabs không unmount — luật handoff mobile §3.11) chứ không
// chỉ chặn side-effect. Sinh ra ở M1 (audit lag 02/09) để gate animation vô hạn + poll cadence.
// Dựa useFocusEffect của expo-router như mọi hook focus khác trong repo.

import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

export function useIsScreenFocused(): boolean {
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  return focused
}
