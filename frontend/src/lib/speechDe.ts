/**
 * Client-side German TTS via Web Speech API (no audio files).
 */

function pickGermanVoice(): SpeechSynthesisVoice | undefined {
  const voices = typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : []
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith('de')) ??
    voices.find((v) => v.lang?.toLowerCase().includes('de'))
  )
}

export function speakGerman(text: string): void {
  if (typeof window === 'undefined') return
  const t = text?.trim()
  if (!t) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(t)
  u.lang = 'de-DE'
  u.rate = 0.92
  const voice = pickGermanVoice()
  if (voice) u.voice = voice
  synth.speak(u)
}

export function stopGermanSpeech(): void {
  if (typeof window !== 'undefined') window.speechSynthesis.cancel()
}

export function primeGermanVoices(): void {
  if (typeof window === 'undefined') return
  const synth = window.speechSynthesis
  if (synth.getVoices().length) return
  const onVoices = () => {
    synth.removeEventListener('voiceschanged', onVoices)
  }
  synth.addEventListener('voiceschanged', onVoices)
}
