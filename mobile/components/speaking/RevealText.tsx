// Reveals AI speech word-by-word at reading pace, synced with the persona "talking"
// state. Tap anywhere on the text to skip to the full sentence. When `active` is false
// (history messages) the full text renders immediately with zero timers — so a long
// chat never runs more than one reveal at a time.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { ThemedText } from '@/components/ui'

type ThemedTextColor = ComponentProps<typeof ThemedText>['color']
type ThemedTextVariant = ComponentProps<typeof ThemedText>['variant']

interface RevealTextProps {
  text: string
  active: boolean
  color?: ThemedTextColor
  variant?: ThemedTextVariant
  msPerWord?: number
  onDone?: () => void
}

const DEFAULT_MS_PER_WORD = 190

export function RevealText({
  text,
  active,
  color = 'primary',
  variant = 'body',
  msPerWord = DEFAULT_MS_PER_WORD,
  onDone,
}: RevealTextProps) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const [count, setCount] = useState(active ? 0 : words.length)
  const doneRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    doneRef.current = false
    if (intervalRef.current) clearInterval(intervalRef.current)

    // History / inactive: show everything at once, no timers.
    if (!active || words.length === 0) {
      setCount(words.length)
      return
    }

    setCount(0)
    intervalRef.current = setInterval(() => {
      setCount((prev) => {
        const next = prev + 1
        if (next >= words.length) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return Math.min(next, words.length)
      })
    }, msPerWord)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [active, words, msPerWord])

  // Fire onDone exactly once when the reveal completes.
  useEffect(() => {
    if (active && !doneRef.current && count >= words.length && words.length > 0) {
      doneRef.current = true
      onDone?.()
    }
  }, [active, count, words.length, onDone])

  function skip() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setCount(words.length)
  }

  const revealing = active && count < words.length
  const shown = revealing ? words.slice(0, count).join(' ') : text

  return (
    <Pressable onPress={revealing ? skip : undefined} disabled={!revealing}>
      <ThemedText variant={variant} color={color}>
        {shown}
        {revealing ? ' ▌' : ''}
      </ThemedText>
    </Pressable>
  )
}
