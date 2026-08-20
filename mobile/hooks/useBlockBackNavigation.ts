// Khoá đường lùi khỏi một màn trong nhóm (auth).
//
// Nhóm (auth) không có cổng chặn "đã đăng nhập", và Stack của expo-router bật
// cử chỉ vuốt-ngược mặc định trên iOS. Sau khi đăng ký, ngăn xếp thực tế là
// [login, onboarding] rồi [login, first-sentence] (vì cả hai bước đều dùng
// router.replace), nên vuốt mép trái ở màn wow đưa người dùng ĐANG ĐĂNG NHẬP về
// màn Đăng nhập — chỉ thoát ra được bằng cách kill app (QA 2026-08-20, F-5).
//
// Khoá có điều kiện chứ không khoá cứng: khách chưa đăng nhập chạy phễu
// value-first vẫn phải lùi về màn Đăng nhập được.

import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'

export function useBlockBackNavigation(enabled: boolean): void {
  const navigation = useNavigation()

  // iOS: tắt cử chỉ vuốt-ngược của native-stack.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !enabled })
  }, [navigation, enabled])

  // Android: nút back cứng không đi qua cử chỉ, phải chặn riêng.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
      return () => sub.remove()
    }, [enabled]),
  )
}
