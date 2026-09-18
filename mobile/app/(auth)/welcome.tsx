import { useEffect } from 'react'
import { View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { ArrowRight } from 'lucide-react-native'
import { motion, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { Screen, ThemedText, Button, BrandMark, YellowSquare, GaGlyph, Icon } from '@/components/ui'

// M0 — màn Chào mừng (Đợt 3 kế hoạch onboarding 17/09/2026, cổng G-1 = bỏ cờ PostHog).
//
// Trạng thái `WELCOME` của máy trạng thái v3.1 (fixture W1: intro_done → PROFILE cho khách).
// Đây là cửa vào duy nhất của phễu value-first: CTA chính đưa thẳng vào wizard KHÔNG cần tài
// khoản; "Tôi đã có tài khoản" là cổng quay lại (login tự hỏi /onboarding/context để đưa người bỏ
// dở về phễu). Đăng ký thẳng vẫn có ở màn Đăng nhập cho ai muốn. Chọn ngôn ngữ vào ở PR i18n (Q-D).
// Không emoji, biểu tượng nhận diện = GaGlyph, điều khiển = Lucide (luật GALERIE_GLYPHS.md).

const VALUE_POINTS: { glyph: 'thoigian' | 'phongvan' | 'lophoc'; text: string }[] = [
  { glyph: 'thoigian', text: 'Lộ trình riêng theo mục tiêu và nhịp học của bạn' },
  { glyph: 'phongvan', text: 'Luyện nói với mentor AI từ buổi đầu tiên' },
  { glyph: 'lophoc', text: 'Câu tiếng Đức đầu tiên trong 2 phút — chưa cần tài khoản' },
]

export default function WelcomeScreen() {
  const c = useTheme().colors

  useEffect(() => {
    captureEvent('welcome_viewed')
  }, [])

  function start() {
    void Haptics.selectionAsync()
    captureEvent('welcome_cta_clicked', { cta: 'start' })
    router.push('/(auth)/onboarding')
  }

  function haveAccount() {
    captureEvent('welcome_cta_clicked', { cta: 'login' })
    router.push('/(auth)/login')
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: space[6], justifyContent: 'center' }}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ gap: space[8] }}
        >
          <View style={{ alignItems: 'center', gap: space[3] }}>
            <BrandMark size={72} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <ThemedText variant="titleLg">Deutsch</ThemedText>
              <ThemedText variant="titleLg" color="brand">
                Flow
              </ThemedText>
            </View>
          </View>

          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <YellowSquare />
              <ThemedText variant="caption" color="secondary">
                Tiếng Đức cho người Việt đi làm, học nghề, du học
              </ThemedText>
            </View>
            <ThemedText variant="display" accessibilityRole="header">
              Học tiếng Đức theo đúng mục tiêu của bạn
            </ThemedText>
          </View>

          <View style={{ gap: space[3] }}>
            {VALUE_POINTS.map((p) => (
              <View key={p.glyph} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: c.surfaceSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GaGlyph name={p.glyph} size={18} ink="secondary" />
                </View>
                <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>
                  {p.text}
                </ThemedText>
              </View>
            ))}
          </View>
        </MotiView>
      </View>

      <View
        style={{
          gap: space[3],
          paddingHorizontal: space[6],
          paddingTop: space[4],
          paddingBottom: space[2],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        }}
      >
        <Button label="Bắt đầu — miễn phí" icon={ArrowRight} iconRight onPress={start} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tôi đã có tài khoản"
          hitSlop={8}
          onPress={haveAccount}
          style={{ alignItems: 'center', paddingVertical: space[2], flexDirection: 'row', justifyContent: 'center', gap: space[1] }}
        >
          <ThemedText variant="bodyStrong" color="accent">
            Tôi đã có tài khoản
          </ThemedText>
          <Icon icon={ArrowRight} size={14} color="accent" />
        </Pressable>
      </View>
    </Screen>
  )
}
