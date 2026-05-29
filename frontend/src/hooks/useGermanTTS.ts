'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type TTSState = 'idle' | 'loading' | 'playing' | 'paused' | 'done' | 'unsupported'

export function useGermanTTS() {
  const [state, setState] = useState<TTSState>('idle')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [progress, setProgress] = useState(0) // 0–1

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setState('unsupported')
    }
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices()
    // Prefer a German voice; fall back to any de-* locale
    return (
      voices.find(v => v.lang === 'de-DE' && v.localService) ??
      voices.find(v => v.lang === 'de-DE') ??
      voices.find(v => v.lang.startsWith('de')) ??
      null
    )
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setProgress(0)

    const load = () => {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'de-DE'
      utter.rate = 0.88  // slightly slower for learners
      utter.pitch = 1

      const voice = pickVoice()
      if (voice) utter.voice = voice

      utter.onstart = () => setState('playing')
      utter.onend = () => { setState('done'); setProgress(1) }
      utter.onerror = () => setState('idle')
      utter.onboundary = (e) => {
        if (e.charLength && text.length > 0) {
          setProgress(Math.min((e.charIndex + e.charLength) / text.length, 1))
        }
      }

      utteranceRef.current = utter
      setState('loading')
      window.speechSynthesis.speak(utter)
    }

    // voices may not be ready yet on first call
    if (window.speechSynthesis.getVoices().length > 0) {
      load()
    } else {
      window.speechSynthesis.onvoiceschanged = () => { load() }
    }
  }, [pickVoice])

  const pause = useCallback(() => {
    window.speechSynthesis?.pause()
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis?.resume()
    setState('playing')
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setState('idle')
    setProgress(0)
  }, [])

  return { state, progress, speak, pause, resume, stop }
}
