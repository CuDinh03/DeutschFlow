// Back cứng Android đi cùng đường với nút back trên header của màn.
//
// Tabs (student) không có stack: GO_BACK mặc định (backBehavior=firstRoute) nhảy về Heute bất kể
// màn cha thật là gì, nên màn nào điều hướng back tường minh (xem lib/examSpeakingNav) cũng phải
// bắt back cứng để hai đường không lệch nhau. Đăng ký theo FOCUS chứ không theo mount (Tabs không
// unmount màn); listener đăng ký sau chạy trước nên thắng listener của NavigationContainer.
// iOS không có back cứng và Tabs không có cử chỉ vuốt-ngược → hook này chỉ có tác dụng trên Android.

import { useCallback } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect } from 'expo-router'

export function useHardwareBack(onBack: () => void): void {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack()
        return true
      })
      return () => sub.remove()
    }, [onBack]),
  )
}
