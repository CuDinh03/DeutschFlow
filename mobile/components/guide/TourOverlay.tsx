// One-time welcome walkthrough for new users. Mounted once in the (student)
// layout: auto-opens for first-time learners (state in SecureStore) and can be
// replayed on demand from the guide screen. A bottom-sheet card carousel using
// the app's theme + Moti, consistent with the rest of the mobile UI.

import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react-native'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Button, Icon } from '@/components/ui'
import { useTourStore } from '@/stores/useTourStore'
import { TOUR_ITEMS, toneStyles } from './tourContent'

export function TourOverlay() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const visible = useTourStore((s) => s.visible)
  const hydrate = useTourStore((s) => s.hydrate)
  const complete = useTourStore((s) => s.complete)
  const [index, setIndex] = useState(0)

  // Read persisted state once on first mount; auto-shows for new users.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const total = TOUR_ITEMS.length + 1 // welcome + feature steps
  const isWelcome = index === 0
  const isLast = index === total - 1
  const item = isWelcome ? null : TOUR_ITEMS[index - 1]
  const tone = item?.tone ?? 'accent'
  const { fg, soft } = toneStyles(theme, tone)
  const StepIcon = item?.icon ?? Sparkles

  const finish = () => {
    setIndex(0)
    void complete()
  }

  const goNext = () => {
    if (isLast) {
      finish()
      return
    }
    void Haptics.selectionAsync()
    setIndex((i) => i + 1)
  }

  const goBack = () => setIndex((i) => Math.max(0, i - 1))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={finish}
    >
      {/* Backdrop — tap to dismiss */}
      <Pressable
        onPress={finish}
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
      >
        {/* Card — swallow taps so they don't dismiss */}
        <Pressable onPress={() => {}}>
          <MotiView
            from={{ translateY: 40, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', ...motion.spring.snappy }}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: radius['3xl'],
              borderTopRightRadius: radius['3xl'],
              paddingHorizontal: space[6],
              paddingTop: space[5],
              paddingBottom: insets.bottom + space[5],
            }}
          >
            {/* Top band: accent gradient line + close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[4] }}>
              <View style={{ height: 5, width: 44, borderRadius: radius.full, backgroundColor: theme.colors.borderStrong }} />
              <Pressable onPress={finish} hitSlop={10}>
                <Icon icon={X} size={20} color="muted" />
              </Pressable>
            </View>

            <MotiView
              key={index}
              from={{ opacity: 0, translateX: 24 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: motion.duration.normal }}
            >
              {/* Icon chip */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: space[4],
                }}
              >
                <StepIcon size={30} color={fg} strokeWidth={2.2} />
              </View>

              {isWelcome ? (
                <View style={{ gap: space[2], minHeight: 132 }}>
                  <ThemedText variant="label" color="muted">
                    CHÀO MỪNG
                  </ThemedText>
                  <ThemedText variant="display">Chào mừng đến với DeutschFlow! 🇩🇪</ThemedText>
                  <ThemedText variant="body" color="secondary">
                    Xem nhanh 4 tính năng chính giúp bạn học tiếng Đức hiệu quả mỗi ngày. Chỉ mất 30 giây.
                  </ThemedText>
                </View>
              ) : (
                <View style={{ gap: space[2], minHeight: 132 }}>
                  <ThemedText variant="label" color={tone}>
                    {`Bước ${index}/${TOUR_ITEMS.length}`}
                  </ThemedText>
                  <ThemedText variant="display">{item!.title}</ThemedText>
                  <ThemedText variant="body" color="secondary">
                    {item!.desc}
                  </ThemedText>
                </View>
              )}
            </MotiView>

            {/* Progress dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[2], marginTop: space[5], marginBottom: space[5] }}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 6,
                    width: i === index ? 22 : 6,
                    borderRadius: radius.full,
                    backgroundColor: i === index ? fg : theme.colors.border,
                  }}
                />
              ))}
            </View>

            {/* Controls */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
              {index > 0 ? (
                <Pressable onPress={goBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                  <Icon icon={ArrowLeft} size={16} color="muted" />
                  <ThemedText variant="bodyStrong" color="muted">
                    Quay lại
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable onPress={finish} hitSlop={8}>
                  <ThemedText variant="bodyStrong" color="faint">
                    Bỏ qua
                  </ThemedText>
                </Pressable>
              )}

              <Button
                label={isLast ? 'Bắt đầu học' : 'Tiếp'}
                onPress={goNext}
                fullWidth={false}
                icon={isLast ? undefined : ArrowRight}
                iconRight
                style={{ paddingHorizontal: space[6] }}
              />
            </View>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
