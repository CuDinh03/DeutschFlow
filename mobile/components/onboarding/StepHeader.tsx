// Header wizard onboarding: nút lùi (hoặc brand mark ở bước đầu) + 4 vạch tiến
// trình vàng + bộ đếm bước. Segments đổi màu theo bước hiện tại — không animate
// layout, chỉ đổi backgroundColor.

import { Pressable, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { BrandMark, Icon, ThemedText } from '@/components/ui'
import { TOTAL_ONBOARDING_STEPS } from '@/lib/onboardingSteps'
import { useT } from '@/lib/i18n'
import { onboardingMessages } from '@/lib/i18n/messages/onboarding'

interface StepHeaderProps {
  /** 0-based. */
  step: number
  /** null → bước đầu: hiện brand mark thay nút lùi. */
  onBack: (() => void) | null
}

export function StepHeader({ step, onBack }: StepHeaderProps) {
  const c = useTheme().colors
  const t = useT(onboardingMessages)
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[5],
        height: 44,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('stepHeader.back')}
          hitSlop={10}
          onPress={onBack}
          style={{ marginLeft: -space[2], padding: space[1] }}
        >
          <Icon icon={ChevronLeft} size={26} color="primary" />
        </Pressable>
      ) : (
        <BrandMark size={26} />
      )}
      {/* Vạch tiến trình thuần trang trí — ẩn khỏi screen reader; thông tin
          thật nằm ở bộ đếm "n/4" bên cạnh. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1, flexDirection: 'row', gap: space[1] }}
      >
        {Array.from({ length: TOTAL_ONBOARDING_STEPS }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: radius.full,
              backgroundColor: i <= step ? c.accent : c.border,
            }}
          />
        ))}
      </View>
      <ThemedText
        variant="label"
        color="secondary"
        accessibilityLabel={t('stepHeader.progress', { step: step + 1, total: TOTAL_ONBOARDING_STEPS })}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {step + 1}/{TOTAL_ONBOARDING_STEPS}
      </ThemedText>
    </View>
  )
}
