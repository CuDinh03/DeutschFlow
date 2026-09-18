import { useCallback, useEffect, useState } from 'react'
import { View, Pressable } from 'react-native'
import { Lock, Play, Square, Users } from 'lucide-react-native'
import { ThemedText, Caption, Icon } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'
import { speakExamLine, stopExamTts } from '@/lib/examTts'
import { canPlayAgain, playsLeft } from '@/lib/playBudget'
import type { AudioTurn } from '@/lib/examApi'

interface ExamAudioProps {
  /** Chuỗi (một giọng) hoặc mảng lượt nói (hai giọng — Hörverstehen Teil 2 của telc; câu dẫn + bài — Teil 1/3). */
  script: string | AudioTurn[]
  label: string
  /** Số lần được nghe; bỏ trống = không giới hạn. */
  maxPlays?: number
  /** Cổng nghi thức của Teil chưa mở (đang đọc Ansage / đếm ngược đọc câu hỏi): nút khoá, nói rõ lý do. */
  locked?: boolean
  /** Bài nghe của MỘT câu: thu gọn, không liệt kê người nói khi chỉ có một nhân vật. */
  compact?: boolean
}

const ROLES = ['PRUEFER', 'PARTNER'] as const

/**
 * Hörtext trong phòng thi trên app.
 *
 * Dùng lại đúng cascade giọng đã có (`examTts`: giọng persona từ server, rơi xuống `expo-speech`
 * khi server hỏng), nên app và web ra cùng một cặp giọng và không phải dựng thêm hạ tầng.
 *
 * 🔑 Tên người nói LUÔN hiện trên màn hình khi có nhiều hơn một nhân vật, kể cả khi chỉ còn một
 * giọng máy — server TTS hỏng là chuyện có thật, và Hörverstehen Teil 2 là 10 câu trên 25 điểm.
 * Lời thoại thì CỐ Ý không in: đây là bài nghe.
 */
export function ExamAudio({ script, label, maxPlays, locked = false, compact = false }: ExamAudioProps) {
  const { colors: c } = useTheme()
  const [used, setUsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [activeLine, setActiveLine] = useState(-1)

  // Rời màn giữa chừng mà không dừng thì giọng vẫn đọc tiếp ở màn sau.
  useEffect(() => () => stopExamTts(), [])

  const turns: AudioTurn[] = Array.isArray(script) ? script.filter((t) => t.text?.trim()) : []
  const isTurns = turns.length > 0
  // Câu dẫn không phải nhân vật: một câu dẫn + một bài vẫn là "một người nói".
  const speakerCount = turns.filter((t) => t.kind !== 'LEAD_IN').length
  const showLines = isTurns && (!compact || speakerCount > 1)
  const left = playsLeft(maxPlays, used)
  const exhausted = !canPlayAgain(maxPlays, used)
  const disabled = !playing && (locked || exhausted)

  const stop = useCallback(() => {
    stopExamTts()
    setPlaying(false)
    setActiveLine(-1)
  }, [])

  const play = useCallback(async () => {
    if (locked || !canPlayAgain(maxPlays, used)) return
    setUsed((n) => n + 1)
    setPlaying(true)
    try {
      if (isTurns) {
        for (let i = 0; i < turns.length; i++) {
          setActiveLine(i)
          await speakExamLine(turns[i].speaker ?? ROLES[i % ROLES.length], turns[i].text)
        }
      } else {
        await speakExamLine('PRUEFER', String(script))
      }
    } finally {
      setPlaying(false)
      setActiveLine(-1)
    }
  }, [isTurns, turns, script, maxPlays, used, locked])

  const hint = locked
    ? 'Nghe hướng dẫn và đọc câu hỏi xong mới phát được.'
    : exhausted
      ? 'Đã dùng hết số lần nghe, đúng như đề thật.'
      : left !== null
        ? `Còn ${left} lượt nghe`
        : 'Nghe không giới hạn'

  return (
    <View style={{ gap: space[3], backgroundColor: c.infoSoft, borderRadius: radius.md, padding: compact ? space[2] : space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Pressable
          onPress={playing ? stop : play}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Dừng' : 'Phát'}
          accessibilityState={{ disabled }}
          style={{
            width: compact ? 36 : 44, height: compact ? 36 : 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: disabled ? c.border : c.accent,
          }}
        >
          <Icon icon={playing ? Square : locked ? Lock : Play} size={compact ? 15 : 18} color="onAccent" />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            {speakerCount > 1 ? <Icon icon={Users} size={14} color="info" /> : null}
            <ThemedText variant="bodyStrong" color="info">{label}</ThemedText>
          </View>
          <Caption color={c.info}>{hint}</Caption>
        </View>
      </View>

      {showLines ? (
        <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2] }}>
          {turns.map((turn, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <ThemedText variant="caption" color={activeLine === idx ? 'info' : 'faint'}>
                {turn.kind === 'LEAD_IN' ? 'Câu dẫn' : turn.name ?? (idx % 2 === 0 ? 'Người 1' : 'Người 2')}
              </ThemedText>
              <ThemedText variant="caption" color="faint">{activeLine === idx ? '▶' : '·'}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
