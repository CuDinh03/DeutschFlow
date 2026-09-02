// Chốt an toàn cho mọi màn ghi âm: rời màn giữa lúc đang ghi thì mic PHẢI dừng
// và audio mode PHẢI thoát record.
//
// Vì sao là useFocusEffect chứ không phải useEffect-cleanup: màn Speaking chính
// là một BOTTOM-TAB — chuyển tab không unmount component (soát 02/09, F-9), nên
// cleanup theo unmount không bao giờ chạy và mic cứ ghi vô thời hạn trong lúc
// người dùng đi làm việc khác (pin + riêng tư + rủi ro App Review). Cleanup của
// useFocusEffect chạy ở CẢ blur lẫn unmount nên phủ được cả tab lẫn stack.
//
// Vì sao phải reset audio mode chứ không chỉ stop: audio mode là cấu hình TOÀN
// APP — một `allowsRecording: true` còn sót làm mọi phát lại sau đó (TTS, video)
// đi ra loa trong (earpiece) rất nhỏ thay vì loa ngoài (soát 02/09, F-11).
// Mẫu gốc: weekly-speaking.tsx đã làm đúng cả hai bước từ trước.

import { useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { setAudioModeAsync, type useAudioRecorder } from 'expo-audio'

type Recorder = ReturnType<typeof useAudioRecorder>

/**
 * @param onAutoStop chạy NGAY khi guard phải tự dừng bản ghi (trước cả
 *   recorder.stop) — nơi màn hình hạ cờ `isRecording`, tắt animation, dọn timer
 *   đếm giây… để UI không kẹt ở trạng thái "đang ghi" khi người dùng quay lại.
 *   Bản ghi dở bị bỏ (không transcribe): người dùng đã rời màn.
 */
export function useRecorderBlurGuard(recorder: Recorder, onAutoStop?: () => void): void {
  // Ref để cleanup luôn thấy callback mới nhất mà không phải re-subscribe
  // useFocusEffect theo từng render.
  const onAutoStopRef = useRef(onAutoStop)
  onAutoStopRef.current = onAutoStop

  useFocusEffect(
    useCallback(
      () => () => {
        if (!recorder.isRecording) return
        onAutoStopRef.current?.()
        void recorder
          .stop()
          .catch(() => {})
          .finally(() => {
            void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
          })
      },
      [recorder],
    ),
  )
}
