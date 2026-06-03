// Shared lip-sync + idle-blink animation for every persona character.
//
// `paused` stops the blink timer entirely. Pass it for the small head-crop avatars
// shown on each chat message so a long conversation never runs dozens of blink
// intervals at once — only the live "hero" persona keeps blinking. This also keeps
// the animation logic in one place instead of duplicated across 15 character files.

import { useEffect, useState } from 'react'

export interface FaceAnimation {
  mouthFrame: number
  blinking: boolean
}

export function useFaceAnimation(isTalking: boolean, paused = false): FaceAnimation {
  const [mouthFrame, setMouthFrame] = useState(2)
  const [blinking, setBlinking] = useState(false)

  // Lip-sync: cycle the mouth frames only while talking.
  useEffect(() => {
    if (!isTalking) {
      setMouthFrame(2)
      return
    }
    const id = setInterval(() => setMouthFrame((f) => (f + 1) % 3), 115)
    return () => clearInterval(id)
  }, [isTalking])

  // Idle blink: skipped entirely when paused (no timer, no re-renders).
  useEffect(() => {
    if (paused) {
      setBlinking(false)
      return
    }
    let tid: ReturnType<typeof setTimeout>
    const blink = () => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 140)
      tid = setTimeout(blink, 2800 + Math.random() * 1800)
    }
    tid = setTimeout(blink, 1800 + Math.random() * 1200)
    return () => clearTimeout(tid)
  }, [paused])

  return { mouthFrame: isTalking ? mouthFrame : 2, blinking }
}
