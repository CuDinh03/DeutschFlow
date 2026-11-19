import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import { ChevronDown } from 'lucide-react-native'
import { motion, space, useTheme } from '@/lib/theme'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { Screen, ThemedText, Icon, FadeIn, Button } from '@/components/ui'
import { MarkTitle, Row, RowList, SectionHead, SubHeader } from '@/components/me/MeParts'
import { useSpotlightTour } from '@/components/guide/SpotlightTour'
import { getDailyGoalMinutes } from '@/lib/dailyGoal'
import { captureEvent } from '@/lib/analytics'
import { GUIDE_ITEMS, FAQ, type GuideItem } from '@/components/guide/tourContent'
import { PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { useBackToMainTab } from '@/hooks/useBackTo'

// Giao diện v3.4 (Đợt 6C, 19/11/2026; mẫu `guide`): "Sổ tay học viên", nút mực "Xem lại hướng dẫn nhanh",
// danh sách tính năng dạng hàng có glyph Galerie, hỏi đáp mở/đóng. GUIDE_ITEMS mang icon Lucide cho tour;
// ở đây biểu tượng nhận diện là glyph (GALERIE_GLYPHS.md), ánh xạ theo `key`.
const GUIDE_GLYPH: Record<string, GlyphName> = {
  dashboard: 'heute',
  roadmap: 'lernweg',
  speaking: 'speaking',
  review: 'srs',
  vocabulary: 'tuvung',
  learn: 'hoc',
  exam: 'thithu',
  streak: 'chuoi',
}

export default function GuideScreen() {
  // Back tường minh — Tabs firstRoute sẽ về Heute (xem lib/screenParents). Từ 19/11/2026 màn này mở
  // được cả từ Hồ sơ lẫn nút "?" của tab Luyện thi, nên về trạm mở gần nhất: Hồ sơ nếu vừa rẽ từ Hồ sơ
  // (như trước), không thì tab chính vừa rời.
  const goBack = useBackToMainTab()
  const { startTour } = useSpotlightTour()
  // The iOS free build ships with no commercial PRO surface, so drop FAQ entries that mention it.
  const faqs = PRO_UNLOCKED_FREE ? FAQ.filter((entry) => !entry.proOnly) : FAQ

  return (
    <Screen scroll edges={['top']} contentStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[10] }}>
      <SubHeader onBack={goBack} />
      <FadeIn style={{ marginTop: space[4], gap: space[2] }}>
        <MarkTitle lead="Sổ tay" mark="học viên" />
        <ThemedText variant="body" color="secondary">
          Tất cả những gì bạn cần để bắt đầu học hiệu quả
        </ThemedText>
      </FadeIn>

      <FadeIn delay={60} style={{ marginTop: space[4] }}>
        <Button
          label="Xem lại hướng dẫn nhanh"
          onPress={() => {
            captureEvent('guide_tour_replay_clicked', { from: 'guide_screen' })
            // Tour spotlight chạy trên Trang chủ — bước 1 tự điều hướng về đó.
            void getDailyGoalMinutes().then((m) =>
              startTour('home', 'replay', { dailyGoalMinutes: m }),
            )
          }}
        />
        <ThemedText variant="caption" color="muted" align="center" style={{ marginTop: space[2] }}>
          Về Trang chủ và chạy lại tour chỉ chỗ từng tính năng
        </ThemedText>
      </FadeIn>

      <SectionHead title="Các tính năng chính" style={{ marginTop: space[6] + 2, marginBottom: space[3] }} />
      <FadeIn delay={100}>
        <RowList>
          {GUIDE_ITEMS.map((item) => (
            <FeatureRow key={item.key} item={item} />
          ))}
        </RowList>
      </FadeIn>

      <SectionHead title="Câu hỏi thường gặp" style={{ marginTop: space[6] + 2, marginBottom: space[3] }} />
      <RowList>
        {faqs.map((entry) => (
          <FaqRow key={entry.q} question={entry.q} answer={entry.a} />
        ))}
      </RowList>
    </Screen>
  )
}

function FeatureRow({ item }: { item: GuideItem }) {
  return (
    <Row
      glyph={GUIDE_GLYPH[item.key] ?? 'huongdan'}
      title={item.title}
      subtitle={`${item.desc}\nCách dùng: ${item.how}`}
      accessibilityLabel={`${item.title}. ${item.desc} Cách dùng: ${item.how}`}
      onPress={() => {
        captureEvent('guide_feature_opened', { feature: item.key })
        router.push(item.route)
      }}
    />
  )
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  const c = useTheme().colors

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityState={{ expanded: open }}
        accessibilityHint="Nhấn để mở hoặc đóng câu trả lời"
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
          minHeight: 56,
          paddingVertical: space[3],
          paddingHorizontal: space[4],
          backgroundColor: pressed ? c.surfaceSunken : 'transparent',
        })}
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
          <ThemedText variant="body" color="secondary" style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
            {answer}
          </ThemedText>
        </MotiView>
      ) : null}
    </View>
  )
}
