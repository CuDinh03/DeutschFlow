import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import { Sparkles, PlayCircle, ChevronDown, ArrowUpRight } from 'lucide-react-native'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, SectionHeader, FadeIn } from '@/components/ui'
import { useTourStore } from '@/stores/useTourStore'
import { useScreenTime } from '@/hooks/useScreenTime'
import { captureEvent } from '@/lib/analytics'
import { GUIDE_ITEMS, FAQ, toneStyles, type GuideItem } from '@/components/guide/tourContent'

export default function GuideScreen() {
  const theme = useTheme()
  const show = useTourStore((s) => s.show)
  useScreenTime('guide')

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingBottom: space[10] }}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[4], gap: space[5] }}>
        <FadeIn>
          <View style={{ gap: space[1] }}>
            <ThemedText variant="display">Hướng dẫn</ThemedText>
            <ThemedText variant="body" color="muted">
              Tất cả những gì bạn cần để bắt đầu học hiệu quả
            </ThemedText>
          </View>
        </FadeIn>

        {/* Replay tour */}
        <FadeIn delay={60}>
          <Card
            onPress={() => {
              captureEvent('guide_tour_replay_clicked', { from: 'guide_screen' })
              show()
            }}
            elevation="lifted"
            style={{ borderColor: theme.colors.accent + '66' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.lg,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Sparkles} size={22} color="accent" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="bodyStrong">Xem lại hướng dẫn nhanh</ThemedText>
                <ThemedText variant="caption" color="muted">
                  Chạy lại tour giới thiệu 4 tính năng chính
                </ThemedText>
              </View>
              <Icon icon={PlayCircle} size={24} color="accent" />
            </View>
          </Card>
        </FadeIn>

        {/* Feature catalogue */}
        <View>
          <SectionHeader title="Các tính năng chính" />
          <View style={{ gap: space[3] }}>
            {GUIDE_ITEMS.map((item, i) => (
              <FadeIn key={item.title} delay={100 + i * 40}>
                <FeatureCard item={item} />
              </FadeIn>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View>
          <SectionHeader title="Câu hỏi thường gặp" />
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            {FAQ.map((entry, i) => (
              <FaqRow key={entry.q} question={entry.q} answer={entry.a} divider={i > 0} />
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  )
}

function FeatureCard({ item }: { item: GuideItem }) {
  const theme = useTheme()
  const { fg, soft } = toneStyles(theme, item.tone)
  const Glyph = item.icon

  return (
    <Card
      onPress={() => {
        captureEvent('guide_feature_opened', { feature: item.key })
        router.push(item.route)
      }}
    >
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: soft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph size={22} color={fg} strokeWidth={2.2} />
          </View>
          <ThemedText variant="title" style={{ flex: 1 }}>
            {item.title}
          </ThemedText>
          <Icon icon={ArrowUpRight} size={18} color="faint" />
        </View>
        <ThemedText variant="body" color="secondary">
          {item.desc}
        </ThemedText>
        <View
          style={{
            backgroundColor: theme.colors.surfaceSunken,
            borderRadius: radius.md,
            paddingHorizontal: space[3],
            paddingVertical: space[3],
          }}
        >
          <ThemedText variant="caption" color="muted">
            <ThemedText variant="caption" color="secondary">
              Cách dùng:{' '}
            </ThemedText>
            {item.how}
          </ThemedText>
        </View>
      </View>
    </Card>
  )
}

function FaqRow({ question, answer, divider }: { question: string; answer: string; divider: boolean }) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <View style={divider ? { borderTopWidth: 1, borderTopColor: theme.colors.border } : undefined}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
          paddingVertical: space[4],
        }}
      >
        <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
          {question}
        </ThemedText>
        <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: motion.duration.fast }}>
          <Icon icon={ChevronDown} size={18} color="faint" />
        </MotiView>
      </Pressable>
      {open ? (
        <MotiView
          from={{ opacity: 0, translateY: -4 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.fast }}
        >
          <ThemedText variant="body" color="secondary" style={{ paddingBottom: space[4] }}>
            {answer}
          </ThemedText>
        </MotiView>
      ) : null}
    </View>
  )
}
