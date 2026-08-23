import api from '@/lib/api'

/**
 * TTS cho phòng thi: Prüfer và Partner dùng HAI giọng khác nhau (persona backend) để thí sinh phân vai
 * bằng tai như thi thật. Fallback Web Speech khi backend TTS lỗi. Một audio tại một thời điểm.
 */
const VOICE_BY_ROLE: Record<string, string> = { PRUEFER: 'ANNA', PARTNER: 'LUKAS' }

let current: HTMLAudioElement | null = null
let muted = false

export function setExamTtsMuted(value: boolean): void {
  muted = value
  if (value) stopExamTts()
}

export function isExamTtsMuted(): boolean {
  return muted
}

export function stopExamTts(): void {
  if (current) {
    current.pause()
    current = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
}

export async function speakExamLine(role: string, text: string): Promise<void> {
  if (muted || !text?.trim()) return
  stopExamTts()
  const persona = VOICE_BY_ROLE[role] ?? 'DEFAULT'
  try {
    const resp = await api.post('/ai-speaking/tts', { text, persona }, { responseType: 'blob' })
    const blob = resp.data as Blob
    if (!blob || blob.size === 0) throw new Error('empty tts')
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    current = audio
    await new Promise<void>((resolve) => {
      const done = () => {
        URL.revokeObjectURL(url)
        if (current === audio) current = null
        resolve()
      }
      audio.onended = done
      audio.onerror = done
      audio.play().catch(done)
    })
  } catch {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'de-DE'
      u.rate = 0.95
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    })
  }
}
