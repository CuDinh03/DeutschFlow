import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import { PlayCircle, ChevronDown, ArrowUpRight } from 'lucide-react-native'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { Screen, Card, ThemedText, Icon, Caption, SectionHeader, FadeIn, AppHeader } from '@/components/ui'
import { useSpotlightTour } from '@/components/guide/SpotlightTour'
import { getDailyGoalMinutes } from '@/lib/dailyGoal'
import { captureEvent } from '@/lib/analytics'
import { GUIDE_ITEMS, FAQ, toneStyles, type GuideItem } from '@/components/guide/tourContent'
import { PRO_UNLOCKED_FREE } from '@/lib/paywall'

export default function GuideScreen() {
  const c = useTheme().colors
  const { startTour } = useSpotlightTour()
  // The iOS free build ships with no commercial PRO surface, so drop FAQ entries that mention it.
  const faqs = PRO_UNLOCKED_FREE ? FAQ.filter((entry) => !entry.proOnly) : FAQ

  return (
    <Screen edges={['top']}>
      <AppHeader
        title="Hướng dẫn"
        subtitle="Sổ tay học viên"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(student)'))}
      />
      <Screen scroll edges={[]} contentStyle={{ paddingBottom: space[10] }}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[4], gap: space[6] }}>
        <FadeIn>
          <ThemedText variant="body" color="muted">
            Tất cả những gì bạn cần để bắt đầu học hiệu quả
          </ThemedText>
        </FadeIn>

        {/* Replay tour — editorial ink hero for the primary action */}
        <FadeIn delay={60}>
          <Card
            onPress={() => {
              captureEvent('guide_tour_replay_clicked', { from: 'guide_screen' })
              // Tour spotlight chạy trên Trang chủ — bước 1 tự điều hướng về đó.
              void getDailyGoalMinutes().then((m) =>
                startTour('home', 'replay', { dailyGoalMinutes: m }),
              )
            }}
            elevation="lifted"
            accessibilityLabel="Xem lại hướng dẫn nhanh"
            accessibilityHint="Về Trang chủ và chạy lại tour hướng dẫn trên màn hình"
            style={{ backgroundColor: c.inkSurface, borderColor: c.inkSurface }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.lg,
                  backgroundColor: c.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={PlayCircle} size={26} color="accent" />
              </View>
              <View style={{ flex: 1, gap: space[1] }}>
                <Caption color={c.accent}>Tour nhanh</Caption>
                <ThemedText variant="title" style={{ color: c.onInk }}>
                  Xem lại hướng dẫn nhanh
                </ThemedText>
                <ThemedText variant="caption" style={{ color: c.onInkMuted }}>
                  Chạy lại tour chỉ chỗ từng tính năng ngay trên màn hình
                </ThemedText>
              </View>
            </View>
          </Card>
        </FadeIn>

        {/* Feature catalogue */}
        <View>
          <View style={{ gap: space[1], marginBottom: space[3] }}>
            <Caption>Khám phá</Caption>
            <ThemedText variant="titleLg">Các tính năng chính</ThemedText>
          </View>
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
          <View style={{ gap: space[1], marginBottom: space[3] }}>
            <Caption>Hỏi & Đáp</Caption>
            <ThemedText variant="titleLg">Câu hỏi thường gặp</ThemedText>
          </View>
          <Card padded={false} style={{ paddingHorizontal: space[4] }}>
            {faqs.map((entry, i) => (
              <FaqRow key={entry.q} question={entry.q} answer={entry.a} divider={i > 0} />
            ))}
          </Card>
        </View>
      </View>
      </Screen>
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
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityState={{ expanded: open }}
        accessibilityHint="Nhấn để mở hoặc đóng câu trả lời"
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
