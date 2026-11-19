// Thanh tiến độ phòng phỏng vấn (giao diện v3.4, Đợt 5; mẫu `room`): năm đoạn theo năm pha phỏng vấn của
// backend (Giới thiệu → Kết thúc) và đồng hồ buổi. Mẫu vẽ "Câu x / 8" nhưng phiên chạy theo pha, không có
// số câu cố định (`PhaseProgressionPolicy`), nên đếm theo pha. Đồng hồ tự chạy trong thành phần này để màn
// hội thoại không phải vẽ lại mỗi giây.

import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { ThemedText } from '@/components/ui'
import { INTERVIEW_PHASES, formatElapsed, interviewPhaseIndex, phaseLabel } from '@/lib/speakingChat'

export function InterviewProgress({ phaseKey, startedAt }: { phaseKey: string | null; startedAt: number }) {
  const c = useTheme().colors
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  // Chưa biết pha (vừa tiếp tục phiên dở, chờ lượt AI kế) ⇒ không đoán là Giới thiệu.
  const current = interviewPhaseIndex(phaseKey)
  const label = phaseKey ? phaseLabel(phaseKey) : phaseLabel(INTERVIEW_PHASES[0])

  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2], gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ThemedText variant="label" style={{ flex: 1 }}>
          {current >= 0 ? `Phần ${current + 1}/${INTERVIEW_PHASES.length} · ${label}` : 'Đang tiếp tục buổi phỏng vấn'}
        </ThemedText>
        <View
          accessible
          accessibilityLabel={`Thời gian buổi: ${formatElapsed(now - startedAt)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.full, backgroundColor: c.surfaceSunken }}
        >
          <ThemedText variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatElapsed(now - startedAt)}</ThemedText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {INTERVIEW_PHASES.map((p, i) => (
          <View
            key={p}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: current < 0 ? c.border : i < current ? c.textPrimary : i === current ? c.accent : c.border,
            }}
          />
        ))}
      </View>
    </View>
  )
}
