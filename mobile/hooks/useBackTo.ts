// Nút back tường minh cho màn ẩn trong Tabs (student): điều hướng tới màn cha thay vì
// `router.back()` (backBehavior firstRoute → luôn về Heute). Back cứng Android đi cùng đường.
// `target` có thể là hàm để tính đích lúc bấm (theo params/dữ liệu đã tải) — giữ trong ref nên
// handler trả về ổn định, không đăng ký lại BackHandler mỗi render.

import { useCallback, useRef } from 'react'
import { router, type Href } from 'expo-router'
import { useHardwareBack } from '@/hooks/useHardwareBack'
import { lastMainTabHref } from '@/lib/screenParents'

type BackTarget = Href | (() => Href)

export function useBackTo(target: BackTarget): () => void {
  const targetRef = useRef<BackTarget>(target)
  targetRef.current = target
  const goBack = useCallback(() => {
    const t = targetRef.current
    router.navigate(typeof t === 'function' ? t() : t)
  }, [])
  useHardwareBack(goBack)
  return goBack
}

/** Màn tiện ích mở từ nhiều tab: về tab chính được mở gần nhất (Heute nếu vào thẳng từ thông báo). */
export function useBackToMainTab(): () => void {
  return useBackTo(lastMainTabHref)
}
