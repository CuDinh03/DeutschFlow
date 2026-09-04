// Em của useRecorderBlurGuard cho MỌI đầu ra còn lại: các màn trong Tabs KHÔNG
// unmount khi chuyển tab (soát 02/09, F-9), nên cleanup theo unmount không bao
// giờ chạy — TTS/phát lại/thuyết minh video cứ kêu tiếp trong lúc người dùng đã
// sang tab khác. Mọi thứ "đang kêu" phải dừng theo BLUR, không phải unmount.
//
// Trả về `focusedRef` để nơi gọi chặn side-effect nổ ra khi màn đang blur:
// phản hồi AI về muộn không được bắt đầu phát tiếng, poll chấm điểm đổi trạng
// thái không được giật điều hướng giữa lưng người dùng… `onFocus` chạy khi màn
// sáng lại (kể cả lần mount đầu) — chỗ trả các việc đã hoãn trong lúc blur.

import { useCallback, useRef, type RefObject } from 'react'
import { useFocusEffect } from 'expo-router'

export function useBlurGuard(onBlur?: () => void, onFocus?: () => void): RefObject<boolean> {
  const focusedRef = useRef(true)
  // Ref để cleanup luôn thấy callback mới nhất mà không re-subscribe
  // useFocusEffect theo từng render (cùng lý do với useRecorderBlurGuard).
  const onBlurRef = useRef(onBlur)
  onBlurRef.current = onBlur
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true
      onFocusRef.current?.()
      return () => {
        focusedRef.current = false
        onBlurRef.current?.()
      }
    }, []),
  )

  return focusedRef
}
