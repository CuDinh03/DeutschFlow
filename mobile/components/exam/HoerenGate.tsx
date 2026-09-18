import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Pressable } from 'react-native'
import { Headphones, Timer } from 'lucide-react-native'
import { ThemedText, Caption, Icon } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import { speakExamLine, stopExamTts } from '@/lib/examTts'
import { NARRATOR_ROLE } from '@/lib/examApi'

/**
 * Pha của cổng. `idle`: chưa bấm bắt đầu, câu hỏi còn ẩn (như chưa mở đề). `ansage`/`framing`:
 * đang đọc. `reading`: đếm ngược đọc câu hỏi, nút nghe khoá. `ready`: nghe được.
 */
export type HoerenGatePhase = 'idle' | 'ansage' | 'reading' | 'framing' | 'ready'

interface HoerenGateProps {
  title: string
  ansage: string
  readingSeconds: number
  framing?: string
  phase: HoerenGatePhase
  onPhaseChange: (phase: HoerenGatePhase) => void
}

/**
 * Cổng nghi thức của một Teil nghe telc: bấm bắt đầu → giọng người dẫn đọc Ansage → đếm ngược thời
 * gian đọc câu hỏi (nút nghe khoá) → đọc câu khung (Teil 1) → nghe được. Bản sinh đôi của
 * `frontend/src/components/exam/HoerenGate.tsx`.
 *
 * `speakExamLine` luôn resolve (server hỏng → giọng máy → im lặng) nên cổng không bao giờ kẹt.
 */
export function HoerenGate({ title, ansage, readingSeconds, framing, phase, onPhaseChange }: HoerenGateProps) {
  const { colors: c } = useTheme()
  const [secondsLeft, setSecondsLeft] = useState(readingSeconds)
  const runRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => () => { runRef.current += 1; stopExamTts() }, [])

  const countdown = useCallback((run: number) =>
    new Promise<void>((resolve) => {
      let left = readingSeconds
      setSecondsLeft(left)
      if (left <= 0) { resolve(); return }
      const timer = setInterval(() => {
        if (runRef.current !== run) { clearInterval(timer); resolve(); return }
        left -= 1
        setSecondsLeft(left)
        if (left <= 0) { clearInterval(timer); resolve() }
      }, 1000)
    }), [readingSeconds])

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    runRef.current += 1
    const run = runRef.current
    onPhaseChange('ansage')
    await speakExamLine(NARRATOR_ROLE, ansage)
    if (runRef.current !== run) return
    if (readingSeconds > 0) {
      onPhaseChange('reading')
      await countdown(run)
      if (runRef.current !== run) return
    }
    if (framing) {
      onPhaseChange('framing')
      await speakExamLine(NARRATOR_ROLE, framing)
      if (runRef.current !== run) return
    }
    onPhaseChange('ready')
  }, [ansage, readingSeconds, framing, countdown, onPhaseChange])

  const message =
    phase === 'idle' ? 'Câu hỏi hiện ra khi bạn bấm bắt đầu — như lúc mở đề thật.'
      : phase === 'ansage' ? 'Đang đọc hướng dẫn…'
        : phase === 'reading' ? `Đọc câu hỏi: còn ${secondsLeft} giây`
          : phase === 'framing' ? 'Đang giới thiệu chủ đề…'
            : 'Bắt đầu nghe được rồi.'

  return (
    <View style={{ gap: space[2], backgroundColor: c.accentSoft, borderRadius: radius.md, padding: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        {phase === 'idle' ? (
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel={`Bắt đầu ${title}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space[2],
              backgroundColor: c.accent, borderRadius: radius.sm, paddingHorizontal: space[3], paddingVertical: space[2],
            }}
          >
            <Icon icon={Headphones} size={16} color="onAccent" />
            <ThemedText variant="bodyStrong" color="onAccent">{`Bắt đầu ${title}`}</ThemedText>
          </Pressable>
        ) : (
          <Icon icon={phase === 'reading' ? Timer : Headphones} size={20} color="info" />
        )}
        <ThemedText variant="body" color="info" style={{ flex: 1 }}>{message}</ThemedText>
      </View>
      {phase === 'idle' && readingSeconds > 0 ? (
        <Caption color={c.info}>{`Sau hướng dẫn, bạn có ${readingSeconds} giây đọc câu hỏi rồi bài mới phát.`}</Caption>
      ) : null}
    </View>
  )
}
