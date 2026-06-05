import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import { Briefcase, GraduationCap } from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { Screen, ThemedText, Button, Icon } from '@/components/ui'

// Onboarding for iOS B2C (MVP checklist §5.1): collect goal, target level, and
// role/industry, then POST /api/onboarding/profile and route straight into the
// first practice session.

type GoalType = 'WORK' | 'CERT'

/** Onboarding routing decision from the backend matrix (design §4). */
interface OnboardingRoute {
  onboardingType: string
  placementRequired: boolean
  assessmentHookAfter: boolean
  paywallAllowed: boolean
  postAction: string
}

/** Fixed mentor preview (no upsell shown on iOS — Apple 3.1.1). */
interface OnboardingMentor {
  code: string
  displayName: string
  difficulty: string
}

const MENTOR_META: Record<string, { emoji: string; tagline: string }> = {
  ANNA: { emoji: '🧑‍🏫', tagline: 'Cố vấn nghề & luyện thi' },
  LUKAS: { emoji: '💻', tagline: 'Tech Lead — CNTT' },
  EMMA: { emoji: '💼', tagline: 'Business & văn phòng' },
  KLAUS: { emoji: '👨‍🍳', tagline: 'Bếp trưởng — Nhà hàng' },
  WEBER: { emoji: '🩺', tagline: 'Bác sĩ da liễu' },
  SARAH: { emoji: '🏥', tagline: 'Trợ lý y khoa' },
  SCHNEIDER: { emoji: '👁️', tagline: 'Bác sĩ mắt' },
  LENA: { emoji: '🛍️', tagline: 'Bán lẻ' },
  THOMAS: { emoji: '🥐', tagline: 'Thợ làm bánh' },
  PETRA: { emoji: '🥩', tagline: 'Cửa hàng thịt' },
  MAX: { emoji: '⚙️', tagline: 'Vận hành máy' },
  OLIVER: { emoji: '🔧', tagline: 'Thợ CNC' },
  NIKLAS: { emoji: '🍽️', tagline: 'Phục vụ nhà hàng' },
  NINA: { emoji: '🏨', tagline: 'Lễ tân khách sạn' },
  HANNIE: { emoji: '🎤', tagline: 'MC / Truyền thông' },
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

// Current level feeds the Platform × Level matrix; A0 = absolute beginner.
const CURRENT_LEVELS: { value: string; label: string }[] = [
  { value: 'A0', label: 'Mới bắt đầu' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
]

const INDUSTRIES: { value: string; label: string }[] = [
  { value: 'IT', label: 'CNTT' },
  { value: 'Pflege', label: 'Điều dưỡng' },
  { value: 'Gastronomie', label: 'Nhà hàng' },
  { value: 'Verkauf', label: 'Bán hàng' },
  { value: 'Tourismus', label: 'Du lịch' },
  { value: 'Technik', label: 'Kỹ thuật' },
]

const EXAMS: { value: string; label: string }[] = [
  { value: 'GOETHE', label: 'Goethe' },
  { value: 'TELC', label: 'telc' },
  { value: 'TESTDAF', label: 'TestDaF' },
]

const DEFAULT_SESSIONS_PER_WEEK = 5
const DEFAULT_MINUTES_PER_SESSION = 15

export default function OnboardingScreen() {
  const theme = useTheme()
  const [goalType, setGoalType] = useState<GoalType>('WORK')
  const [currentLevel, setCurrentLevel] = useState<string | null>(null)
  const [targetLevel, setTargetLevel] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [examType, setExamType] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showUpsell, setShowUpsell] = useState(false)
  const [mentor, setMentor] = useState<OnboardingMentor | null>(null)

  const canSubmit = !!targetLevel

  // Live mentor preview — updates as the learner picks goal / level / industry.
  useEffect(() => {
    let active = true
    api
      .get<OnboardingMentor>('/onboarding/mentor', {
        params: { goalType, industry: industry ?? undefined, currentLevel: currentLevel ?? undefined },
      })
      .then(({ data }) => {
        if (active) setMentor(data)
      })
      .catch(() => { /* mentor preview is best-effort */ })
    return () => {
      active = false
    }
  }, [goalType, industry, currentLevel])

  async function handleSubmit() {
    if (!targetLevel) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn trình độ mục tiêu.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/onboarding/profile', {
        goalType,
        targetLevel,
        currentLevel,
        ageRange: null,
        interests: [],
        industry: goalType === 'WORK' ? industry : null,
        workUseCases: [],
        examType: goalType === 'CERT' ? examType : null,
        sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
        minutesPerSession: DEFAULT_MINUTES_PER_SESSION,
        learningSpeed: 'NORMAL',
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      captureEvent('onboarding_completed', { goalType, targetLevel })

      // Resolve which archetype the matrix routed this learner through. X-Platform
      // (ios/android) is sent automatically; pass currentLevel so the band is real.
      let route: OnboardingRoute | null = null
      try {
        const { data } = await api.get<OnboardingRoute>('/onboarding/route', {
          params: currentLevel ? { currentLevel } : undefined,
        })
        route = data
        captureEvent('onboarding_type_assigned', {
          onboardingType: data.onboardingType,
          postAction: data.postAction,
          paywallAllowed: data.paywallAllowed,
        })
      } catch { /* analytics/route is best-effort */ }

      // iOS "reader app" (Apple 3.1.1): no in-app pricing — offer email-upsell consent.
      if (route?.postAction === 'EMAIL_CAPTURE_UPSELL') {
        setShowUpsell(true)
        return
      }
      router.replace('/(student)/speaking')
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Không lưu được', apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpsellConsent(optIn: boolean) {
    if (optIn) {
      try {
        await api.post('/onboarding/upsell-interest')
        captureEvent('upsell_opt_in', { source: 'onboarding' })
      } catch { /* best-effort */ }
    } else {
      captureEvent('upsell_dismissed', { source: 'onboarding' })
    }
    router.replace('/(student)/speaking')
  }

  if (showUpsell) {
    return <UpsellConsent onChoice={handleUpsellConsent} />
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[6], paddingBottom: space[10], gap: space[8] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ gap: space[2] }}
        >
          <ThemedText variant="display">Chào mừng! 🇩🇪</ThemedText>
          <ThemedText variant="body" color="muted">
            Vài câu hỏi nhanh để cá nhân hoá lộ trình của bạn.
          </ThemedText>
        </MotiView>

        {/* Goal */}
        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong">Mục tiêu của bạn</ThemedText>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <GoalCard
              active={goalType === 'WORK'}
              icon={Briefcase}
              title="Đi làm"
              subtitle="Giao tiếp & phỏng vấn"
              onPress={() => setGoalType('WORK')}
            />
            <GoalCard
              active={goalType === 'CERT'}
              icon={GraduationCap}
              title="Thi chứng chỉ"
              subtitle="Goethe / telc / TestDaF"
              onPress={() => setGoalType('CERT')}
            />
          </View>
        </View>

        {/* Current level */}
        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong">Trình độ hiện tại</ThemedText>
          <ChipRow options={CURRENT_LEVELS} selected={currentLevel} onSelect={setCurrentLevel} />
        </View>

        {/* Target level */}
        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong">Trình độ mục tiêu</ThemedText>
          <ChipRow
            options={LEVELS.map((l) => ({ value: l, label: l }))}
            selected={targetLevel}
            onSelect={setTargetLevel}
          />
        </View>

        {/* Role / industry or exam */}
        {goalType === 'WORK' ? (
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">
              Lĩnh vực <ThemedText variant="caption" color="faint">(tuỳ chọn)</ThemedText>
            </ThemedText>
            <ChipRow options={INDUSTRIES} selected={industry} onSelect={setIndustry} />
          </View>
        ) : (
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong">
              Kỳ thi <ThemedText variant="caption" color="faint">(tuỳ chọn)</ThemedText>
            </ThemedText>
            <ChipRow options={EXAMS} selected={examType} onSelect={setExamType} />
          </View>
        )}

        {/* Mentor preview */}
        {mentor && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              padding: space[4],
              borderRadius: radius.xl,
              borderWidth: 1.5,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.accentSoft,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accent,
              }}
            >
              <ThemedText variant="bodyStrong">{MENTOR_META[mentor.code]?.emoji ?? '🧑‍🏫'}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" color="muted">
                Mentor của bạn
              </ThemedText>
              <ThemedText variant="bodyStrong" color="accent">
                {mentor.displayName}
              </ThemedText>
              <ThemedText variant="caption" color="muted">
                {MENTOR_META[mentor.code]?.tagline ?? 'Người đồng hành học tập'}
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space[6], paddingBottom: space[2] }}>
        <Button
          label="Bắt đầu luyện tập"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * iOS web-upsell consent (Apple 3.1.1 "reader app"): opt in to receive PRO info by
 * email. Deliberately no pricing, "buy", or external purchase links — just consent.
 */
function UpsellConsent({ onChoice }: { onChoice: (optIn: boolean) => void }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space[6], gap: space[6] }}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.slow }}
          style={{ gap: space[3] }}
        >
          <ThemedText variant="display">Học đến đâu, nhắc đến đó ✉️</ThemedText>
          <ThemedText variant="body" color="muted">
            Bạn có muốn nhận email gợi ý lộ trình và các tính năng nâng cao của DeutschFlow không?
            Chúng tôi chỉ gửi nội dung hữu ích và bạn có thể huỷ bất cứ lúc nào.
          </ThemedText>
        </MotiView>
      </View>
      <View style={{ paddingHorizontal: space[6], paddingBottom: space[2], gap: space[3] }}>
        <Button label="Đồng ý nhận email" onPress={() => onChoice(true)} />
        <Button label="Để sau" variant="ghost" onPress={() => onChoice(false)} />
      </View>
    </Screen>
  )
}

interface ChipOption {
  value: string
  label: string
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: ChipOption[]
  selected: string | null
  onSelect: (value: string) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((opt) => {
        const active = selected === opt.value
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync()
              onSelect(opt.value)
            }}
            style={{
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.accentSoft : colors.surface,
            }}
          >
            <ThemedText variant="bodyStrong" color={active ? 'accent' : 'secondary'}>
              {opt.label}
            </ThemedText>
          </Pressable>
        )
      })}
    </View>
  )
}

function GoalCard({
  active,
  icon,
  title,
  subtitle,
  onPress,
}: {
  active: boolean
  icon: typeof Briefcase
  title: string
  subtitle: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
      style={{
        flex: 1,
        gap: space[2],
        padding: space[4],
        borderRadius: radius.xl,
        borderWidth: 1.5,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
      }}
    >
      <Icon icon={icon} size={24} color={active ? 'accent' : 'muted'} />
      <ThemedText variant="bodyStrong" color={active ? 'accent' : 'primary'}>
        {title}
      </ThemedText>
      <ThemedText variant="caption" color="muted">
        {subtitle}
      </ThemedText>
    </Pressable>
  )
}
