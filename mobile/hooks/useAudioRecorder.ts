// Shared microphone-record lifecycle. Owns the iOS audio-mode juggling
// (allowsRecordingIOS true → false on stop) so a stuck record-mode never
// routes the next TTS reply to the earpiece, and turns mic-permission denial
// from a generic catch-all error into an actionable "Open Settings" prompt.
//
// Used by both speaking.tsx and weekly-speaking.tsx (previously duplicated
// the recording flow nearly verbatim).

import { useCallback, useRef, useState } from 'react'
import { Alert, Linking } from 'react-native'
import { Audio } from 'expo-av'
import * as Haptics from 'expo-haptics'

type RecorderState = 'idle' | 'recording' | 'transcribing'

export interface UseAudioRecorder {
  state: RecorderState
  isRecording: boolean
  /** Returns true when the recording actually started, false otherwise (e.g. permission denied). */
  start: () => Promise<boolean>
  /** Stops the recording and returns the file URI (caller transcribes). null when no recording is active. */
  stop: () => Promise<string | null>
  /** Reset to idle (e.g. after a transcription completes). */
  reset: () => void
}

export function useAudioRecorder(): UseAudioRecorder {
  const [state, setState] = useState<RecorderState>('idle')
  const recRef = useRef<Audio.Recording | null>(null)

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const { status, canAskAgain } = await Audio.requestPermissionsAsync()
    if (status === 'granted') return true
    if (!canAskAgain) {
      // On iOS the OS won't show the prompt again after a hard denial; the only fix
      // is for the user to flip the toggle in Settings. Branch the alert to offer that.
      Alert.alert(
        'Cần quyền microphone',
        'Hãy bật microphone trong Cài đặt để luyện nói.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => { void Linking.openSettings() } },
        ],
      )
    } else {
      Alert.alert('Không có quyền microphone', 'Bạn cần cấp quyền để ghi âm.')
    }
    return false
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    if (!(await ensurePermission())) return false
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      recRef.current = recording
      setState('recording')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      return true
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động microphone.')
      return false
    }
  }, [ensurePermission])

  const stop = useCallback(async (): Promise<string | null> => {
    const rec = recRef.current
    if (!rec) return null
    recRef.current = null
    setState('transcribing')
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await rec.stopAndUnloadAsync()
      return rec.getURI()
    } finally {
      // ALWAYS restore playback mode so the next TTS reply routes to the speaker, not
      // the earpiece — expo-av merges partial audio modes, and a stuck `allowsRecordingIOS`
      // is the classic "why is the reply muted?" bug.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
    }
  }, [])

  const reset = useCallback(() => setState('idle'), [])

  return { state, isRecording: state === 'recording', start, stop, reset }
}
