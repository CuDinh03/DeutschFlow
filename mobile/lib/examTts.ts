// Giọng nói phòng thi (giám khảo/partner) — cascade như speaking.tsx:
//   1. Server TTS theo persona (speakingApi.tts → base64 mp3, phát qua expo-audio)
//   2. expo-speech de-DE nếu server TTS hỏng
//   3. Im lặng (caller tự chạy tiếp) — luồng thi không bao giờ kẹt vì thiếu giọng.
//
// Độc lập với lib/germanTts.ts (bản first-sentence, chỉ expo-speech): phòng thi
// cần đúng GIỌNG persona (PRUEFER=ANNA, PARTNER=THOMAS — đồng bộ web examTts.ts)
// và cần stop() gọi được từ ngoài trước khi thu âm, kẻo giọng AI lọt vào mic.
//
// Hai token tách bạch (bài học tự soát 02/09 — gộp một token là chuỗi 3 lượt tự
// huỷ ở lượt 3 vì mỗi lượt phát đều bump token khi dọn lượt trước):
//   • playGen  — vô hiệu callback của LƯỢT PHÁT cũ; bump mỗi lần dọn playback.
//   • seqGen   — huỷ CHUỖI đang đọc; chỉ bump bởi stopExamTts() (bên ngoài gọi
//                khi bắt đầu thu âm/rời màn) và khi một chuỗi mới bắt đầu.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import { speakingApi } from './speakingApi'
import { EXAM_VOICE_BY_ROLE } from './examSpeakingUi'

let player: AudioPlayer | null = null
let fileSeq = 0
let playGen = 0
let seqGen = 0

function stopPlaybackOnly(): void {
  playGen += 1
  const p = player
  player = null
  if (p) {
    try { p.remove() } catch { /* released */ }
  }
  try {
    const Speech = require('expo-speech') as typeof import('expo-speech')
    Speech.stop()
  } catch { /* module không có trong binary — bỏ qua */ }
}

/** Dừng mọi giọng đang phát VÀ huỷ chuỗi đang đọc — gọi trước khi thu âm/rời màn. */
export function stopExamTts(): void {
  seqGen += 1
  stopPlaybackOnly()
}

// Tắt tiếng giám khảo (parity web): transcript vẫn hiện, chỉ không phát — bật lại là phát tiếp từ lượt sau.
let muted = false

export function setExamTtsMuted(value: boolean): void {
  muted = value
  if (value) stopExamTts()
}

export function isExamTtsMuted(): boolean {
  return muted
}

/** Phát một câu theo vai (PRUEFER/PARTNER). Resolve khi phát XONG (hoặc bỏ cuộc êm). */
export async function speakExamLine(role: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || muted) return
  stopPlaybackOnly()
  const myPlay = playGen

  // 1. Server TTS đúng giọng persona.
  try {
    const voice = EXAM_VOICE_BY_ROLE[role] ?? 'DEFAULT'
    const base64 = await speakingApi.tts(trimmed, voice)
    if (myPlay !== playGen) return
    const path = `${FileSystem.cacheDirectory}exam-tts-${fileSeq++}.mp3`
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 })
    if (myPlay !== playGen) {
      void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})
      return
    }
    // Thoát record mode để giọng ra loa ngoài (audio mode là cấu hình toàn app).
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    await new Promise<void>((resolve) => {
      const p = createAudioPlayer({ uri: path })
      player = p
      p.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) {
          try { p.remove() } catch { /* released */ }
          if (player === p) player = null
          void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})
          resolve()
        }
      })
      p.play()
    })
    return
  } catch {
    // Server TTS hỏng/chưa cấu hình — rơi xuống giọng máy.
  }

  // 2. expo-speech nếu có trong binary.
  try {
    const Speech = require('expo-speech') as typeof import('expo-speech')
    if (myPlay !== playGen) return
    await new Promise<void>((resolve) => {
      Speech.speak(trimmed, {
        language: 'de-DE',
        rate: 0.96,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      })
    })
  } catch {
    // 3. Không có đường phát nào — im lặng, luồng thi vẫn chạy tiếp.
  }
}

/** Phát lần lượt nhiều lượt AI (B1 T3: partner trả lời rồi giám khảo hỏi = 2 lượt). */
export async function speakExamSequence(turns: readonly { role: string; text: string }[]): Promise<void> {
  const mySeq = ++seqGen
  for (const t of turns) {
    if (mySeq !== seqGen) return // stopExamTts() hoặc chuỗi mới đã chen — nhường
    await speakExamLine(t.role, t.text)
  }
}
