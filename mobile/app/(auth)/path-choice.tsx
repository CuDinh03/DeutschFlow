// Route `PATH_CHOICE` cho người ĐÃ có tài khoản (Đợt 3 PR-2, 19/09/2026).
//
// Tới đây từ `nextAfterProfile()` khi hồ sơ đã lưu mà A1+ chưa chọn đường (fixture R5: đăng ký
// thẳng, hoặc claim phiên khách không có `pathChoice`). Khách KHÔNG đi qua route này — họ chọn
// ngay trong wizard (sub-screen) trước cổng tài khoản (I-9). Fixture C3/C5: placement → màn
// Kiểm tra đầu vào; skip → Trang chủ tuần đầu (checklist mời lại sau).

import { useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { captureEvent } from '@/lib/analytics'
import { normalizePlacementLevel } from '@/lib/placementTest'
import { useBlockBackNavigation } from '@/hooks/useBlockBackNavigation'
import { PathChoiceCard, type MobilePathChoice } from '@/components/onboarding/PathChoiceCard'

export default function PathChoiceScreen() {
  const { level: rawLevel } = useLocalSearchParams<{ level?: string }>()
  // Route chỉ có nghĩa với A1+; param hỏng thì vẫn hỏi (không chặn), placement sẽ tự tra hồ sơ.
  const level = normalizePlacementLevel(rawLevel) ?? 'A1'

  // Màn này chỉ tới được sau khi đã lưu hồ sơ ⇒ đang đăng nhập; lùi là rơi vào Đăng nhập (F-5).
  useBlockBackNavigation(true)

  useEffect(() => {
    captureEvent('onboarding_placement_offered', { currentLevel: level, surface: 'path_choice' })
  }, [level])

  function pick(choice: MobilePathChoice) {
    void Haptics.selectionAsync()
    captureEvent('onboarding_path_selected', { path: choice, level, guest: false })
    if (choice === 'placement') {
      router.replace({ pathname: '/(auth)/placement', params: { level } })
      return
    }
    captureEvent('onboarding_placement_skipped', { currentLevel: level, at: 'path_choice' })
    router.replace('/(student)')
  }

  return <PathChoiceCard level={level} cap="Trước khi vào lộ trình" onPick={pick} />
}
