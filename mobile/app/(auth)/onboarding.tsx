import { useState } from 'react'
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

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

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
  const [targetLevel, setTargetLevel] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [examType, setExamType] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = !!targetLevel

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
        currentLevel: null,
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
      // Auto-start the first practice session.
      router.replace('/(student)/speaking')
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Không lưu được', apiMessage(e))
    } finally {
      setSubmitting(false)
    }
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
