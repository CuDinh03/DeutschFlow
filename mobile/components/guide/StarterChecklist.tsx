// Checklist "Bắt đầu" tuần đầu (onboarding v1 §7.1) — card trên Trang chủ, chỉ
// hiện cho user đã đi qua flow onboarding v1 (cờ first_sentence) và biến mất
// VĨNH VIỄN sau khi hoàn thành đủ 5 mục (mini celebration trước khi ẩn).

import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import Svg, { Circle } from 'react-native-svg'
import { Check, Mic, BookOpen, Brain, Bell, GitBranch, type LucideIcon } from 'lucide-react-native'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Card, ThemedText, Caption } from '@/components/ui'
import { captureEvent } from '@/lib/analytics'
import { useStarterStore, SRS_CHECKLIST_TARGET } from '@/stores/useStarterStore'

const CELEBRATE_MS = 2400

interface ChecklistItem {
  key: string
  icon: LucideIcon
  label: string
  done: boolean
  onPress: () => void
}

export function StarterChecklist({
  lessonDone,
  onEnableReminder,
}: {
  /** Đã hoàn thành ít nhất 1 chặng skill-tree (server-derived, home đã có query). */
  lessonDone: boolean
  /** Mở sheet nhắc học (item "Bật nhắc học"). */
  onEnableReminder: () => void
}) {
  const theme = useTheme()
  const starter = useStarterStore()
  const [celebrating, setCelebrating] = useState(false)
  const celebratedRef = useRef(false)

  const items: ChecklistItem[] = [
    {
      key: 'speak',
      icon: Mic,
      label: 'Nói câu tiếng Đức đầu tiên',
      done: starter.spokeFirstSentence,
      onPress: () => router.push('/(auth)/first-sentence'),
    },
    {
      key: 'lesson',
      icon: GitBranch,
      label: 'Học chặng đầu tiên',
      done: lessonDone,
      onPress: () => router.navigate('/(student)/learn'),
    },
    {
      key: 'srs',
      icon: BookOpen,
      label: `Ôn ${SRS_CHECKLIST_TARGET} thẻ SRS (${Math.min(starter.srsReviews, SRS_CHECKLIST_TARGET)}/${SRS_CHECKLIST_TARGET})`,
      done: starter.srsReviews >= SRS_CHECKLIST_TARGET,
      onPress: () => router.push('/(student)/srs'),
    },
    {
      key: 'speaking',
      icon: Brain,
      label: 'Thử 1 buổi Speaking',
      done: starter.speakingSessionStarted,
      onPress: () => router.navigate('/(student)/speaking'),
    },
    {
      key: 'reminder',
      icon: Bell,
      label: 'Bật nhắc học mỗi tối',
      done: starter.reminderEnabled,
      onPress: onEnableReminder,
    },
  ]
  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  // Xong hết → mini celebration rồi tự ẩn vĩnh viễn.
  useEffect(() => {
    if (!allDone || celebratedRef.current || starter.checklistDismissed) return
    celebratedRef.current = true
    setCelebrating(true)
    captureEvent('onb_starter_checklist_completed', {})
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const t = setTimeout(() => {
      setCelebrating(false)
      useStarterStore.getState().dismissChecklist()
    }, CELEBRATE_MS)
    return () => clearTimeout(t)
  }, [allDone, starter.checklistDismissed])

  if (!starter.hydrated || starter.checklistDismissed) return null
  if (allDone && !celebrating) return null

  if (celebrating) {
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', ...motion.spring.bouncy }}
        style={{ marginHorizontal: space[5], marginTop: space[4] }}
      >
        <Card style={{ alignItems: 'center', gap: space[2], borderColor: theme.colors.accent }}>
          <ThemedText variant="display">🎉</ThemedText>
          <ThemedText variant="title">Khởi động hoàn hảo!</ThemedText>
          <ThemedText variant="caption" color="muted">
            Bạn đã thử hết các công cụ chính — giờ chỉ cần đều đặn mỗi ngày.
          </ThemedText>
        </Card>
      </MotiView>
    )
  }

  return (
    <Card style={{ marginHorizontal: space[5], marginTop: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <ProgressRing value={doneCount / items.length} label={`${doneCount}/${items.length}`} />
        <View style={{ flex: 1, gap: 2 }}>
          <Caption color={theme.colors.accent}>Bắt đầu</Caption>
          <ThemedText variant="title">Tuần đầu của bạn</ThemedText>
        </View>
      </View>
      <View>
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: item.done }}
            disabled={item.done}
            onPress={item.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              paddingVertical: space[2],
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: theme.colors.border,
              opacity: item.done ? 0.55 : 1,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: item.done ? theme.colors.success : theme.colors.borderStrong,
                backgroundColor: item.done ? theme.colors.successSoft : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.done ? (
                <Check size={15} color={theme.colors.success} strokeWidth={3} />
              ) : (
                <item.icon size={14} color={theme.colors.textMuted} strokeWidth={2.2} />
              )}
            </View>
            <ThemedText
              variant="body"
              color={item.done ? 'muted' : 'primary'}
              style={item.done ? { textDecorationLine: 'line-through' } : undefined}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Card>
  )
}

// Vòng tiến trình tĩnh (SVG render lại theo state — không animate attribute,
// tránh gotcha Fabric + react-native-svg của repo này).
function ProgressRing({ value, label }: { value: number; label: string }) {
  const theme = useTheme()
  const size = 48
  const stroke = 4
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - Math.min(Math.max(value, 0), 1))}
        />
      </Svg>
      <ThemedText variant="label">{label}</ThemedText>
    </View>
  )
}
