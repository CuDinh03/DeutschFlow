// Reliable German TTS for practice drills (Hören / Sprechen models).
//
// Cascade — mirrors app/(student)/speaking.tsx, which is the known-working path:
//   1. Server Edge-TTS (`/ai-speaking/tts`) — free, natural German, `isAuthenticated()` only
//      (no PRO gate, no AI-token cost). Returns 503 when no sidecar is configured → fall through.
//   2. On-device speech (expo-speech, de-DE) — universal offline fallback.
//   3. Silent no-op when neither is available.
//
// The critical fix over the old inline `speakDe`: we set the audio mode to play in silent
// mode BEFORE speaking, so the iOS ringer/silent switch no longer mutes the audio — that was
// why the speaker button produced no sound.
//
// Concurrency: a monotonic `playToken` ensures only the most recently started request actually
// plays — a rapid second tap (or a stop) supersedes any in-flight request so clips can't overlap.
// A module-level recording guard makes play and record mutually exclusive: `speakGerman` is a
// no-op while a drill recording is live, so it can't flip the audio session out from under an
// active recorder.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import * as FileSystem from 'expo-file-system/legacy'
import { speakingApi } from './speakingApi'

let activePlayer: AudioPlayer | null = null
let activePath: string | null = null
let seq = 0
// Bumped on every new request / stop; an in-flight request whose token is stale drops itself.
let playToken = 0
// True while a drill recording is capturing — playback must not steal the audio session.
let recordingActive = false

/** Called by the recorder around record start/stop so playback stays mutually exclusive with it. */
export function setGermanRecordingActive(active: boolean): void {
  recordingActive = active
}

/** Stop any in-flight German audio (server player + on-device speech). Safe to call anytime. */
export async function stopGermanSpeech(): Promise<void> {
  playToken++ // invalidate any request currently awaiting its TTS fetch
  if (activePlayer) {
    const p = activePlayer
    const path = activePath
    activePlayer = null
    activePath = null
    try {
      p.remove()
    } catch {
      // already released
    }
    if (path) void FileSystem.deleteAsync(path, { idempotent: true })
  }
  try {
    ;(require('expo-speech') as typeof import('expo-speech')).stop()
  } catch {
    // expo-speech not linked in this build — nothing to stop.
  }
}

function speakOnDevice(text: string): void {
  try {
    const Speech = require('expo-speech') as typeof import('expo-speech')
    Speech.stop()
    Speech.speak(text, { language: 'de-DE', rate: 0.95 })
  } catch {
    // expo-speech not linked — no audio available in this build.
  }
}

/**
 * Speak a short German string aloud. Resolves once playback has been kicked off (not when it
 * finishes). No-ops on empty text or while a recording is active. Never throws — audio is
 * best-effort.
 */
export async function speakGerman(text?: string): Promise<void> {
  const trimmed = (text ?? '').trim()
  if (!trimmed || recordingActive) return

  await stopGermanSpeech()
  const myToken = ++playToken // claim latest AFTER stopping the previous request

  // Route audio to the speaker even with the silent switch on, and leave record mode so
  // playback isn't stuck on the (quiet) earpiece after a prior recording.
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
  } catch {
    // audio module unavailable — on-device speech below still degrades gracefully.
  }

  // 1. Server Edge-TTS.
  try {
    const base64 = await speakingApi.tts(trimmed, 'DEFAULT')
    if (myToken !== playToken) return // a newer request (or stop) superseded us — drop cleanly
    const path = `${FileSystem.cacheDirectory}skill-tts-${seq++}.mp3`
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 })
    if (myToken !== playToken) {
      void FileSystem.deleteAsync(path, { idempotent: true })
      return
    }
    const player = createAudioPlayer({ uri: path })
    activePlayer = player
    activePath = path
    player.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) {
        try {
          player.remove()
        } catch {
          // already released
        }
        void FileSystem.deleteAsync(path, { idempotent: true })
        if (activePlayer === player) {
          activePlayer = null
          activePath = null
        }
      }
    })
    player.play()
    return
  } catch {
    // Provider not configured (503) / playback failed — fall through to on-device.
  }

  // 2. On-device speech.
  if (myToken !== playToken) return
  speakOnDevice(trimmed)
}
