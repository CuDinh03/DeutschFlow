import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import api, { apiMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { saveOnboardingDraft, readOnboardingDraft, clearOnboardingDraft } from '@/lib/onboardingDraft'
import { PRO_UNLOCKED_FREE } from '@/lib/paywall'
import { Screen, ThemedText, Button } from '@/components/ui'

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

// "Vì sao bạn học?" — the emotional anchor; derives a coarse goalType (EXAM → CERT, else WORK).
const MOTIVATIONS: { value: string; label: string; goal: GoalType }[] = [
  { value: 'JOB', label: '💼 Đi làm tại Đức', goal: 'WORK' },
  { value: 'AUSBILDUNG', label: '🛠️ Học nghề', goal: 'WORK' },
  { value: 'STUDY', label: '🎓 Du học', goal: 'WORK' },
  { value: 'IMMIGRATION', label: '🏠 Định cư / đoàn tụ', goal: 'WORK' },
  { value: 'EXAM', label: '📜 Thi chứng chỉ', goal: 'CERT' },
  { value: 'HOBBY', label: '✨ Sở thích', goal: 'WORK' },
]

// Daily study goal (minutes) — the streak anchor.
const DAILY_GOALS: { value: string; label: string }[] = [
  { value: '5', label: '5 phút' },
  { value: '10', label: '10 phút' },
  { value: '15', label: '15 phút' },
  { value: '20', label: '20 phút' },
]

const DEFAULT_SESSIONS_PER_WEEK = 5
const DEFAULT_MINUTES_PER_SESSION = 15

export default function OnboardingScreen() {
  const theme = useTheme()
  const [motivation, setMotivation] = useState('JOB')
  const [goalType, setGoalType] = useState<GoalType>('WORK')   // derived from motivation
  const [dailyGoal, setDailyGoal] = useState('15')             // minutes/day — streak anchor
  const [currentLevel, setCurrentLevel] = useState<string | null>(null)
  const [targetLevel, setTargetLevel] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [examType, setExamType] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showUpsell, setShowUpsell] = useState(false)
  const [mentor, setMentor] = useState<OnboardingMentor | null>(null)
  // Value-first auth inversion: a guest runs the funnel before signing up.
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const isGuest = !isLoggedIn
  const [guestQuickWin, setGuestQuickWin] = useState(false)   // guest: quick-win + signup gate
  const [resuming, setResuming] = useState(false)             // authed: replaying a guest draft

  const canSubmit = !!targetLevel

  // Live mentor preview — updates as the learner picks goal / level / industry.
  useEffect(() => {
    let active = true
    // Guests use the public preview endpoint (no auth); authed users use the live one.
    const endpoint = isLoggedIn ? '/onboarding/mentor' : '/onboarding/preview/mentor'
    api
      .get<OnboardingMentor>(endpoint, {
        params: { goalType, industry: industry ?? undefined, currentLevel: currentLevel ?? undefined },
      })
      .then(({ data }) => {
        if (active) setMentor(data)
      })
      .catch(() => { /* mentor preview is best-effort */ })
    return () => {
      active = false
    }
  }, [isLoggedIn, goalType, industry, currentLevel])

  // Post-signup resume: a guest filled the funnel, we saved a draft, sent them to /register,
  // and register routed back here (now authenticated). Replay the draft → save profile → route.
  useEffect(() => {
    if (!isLoggedIn) return
    let active = true
    ;(async () => {
      const draft = await readOnboardingDraft()
      if (!active || !draft) return
      setResuming(true)
      await clearOnboardingDraft()
      try {
        await api.post('/onboarding/profile', {
          goalType: draft.goalType,
          targetLevel: draft.targetLevel,
          currentLevel: draft.currentLevel,
          motivation: draft.motivation,
          ageRange: null,
          interests: [],
          industry: draft.goalType === 'WORK' ? draft.industry : null,
          workUseCases: [],
          examType: draft.goalType === 'CERT' ? draft.examType : null,
          sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
          minutesPerSession: DEFAULT_MINUTES_PER_SESSION,
          dailyGoalMinutes: parseInt(draft.dailyGoal, 10),
          learningSpeed: 'NORMAL',
        })
        captureEvent('onboarding_completed', { goalType: draft.goalType, targetLevel: draft.targetLevel })
        let route: OnboardingRoute | null = null
        try {
          const { data } = await api.get<OnboardingRoute>('/onboarding/route', {
            params: draft.currentLevel ? { currentLevel: draft.currentLevel } : undefined,
          })
          route = data
          captureEvent('onboarding_type_assigned', {
            onboardingType: data.onboardingType, postAction: data.postAction, paywallAllowed: data.paywallAllowed,
          })
        } catch { /* route is best-effort */ }
        // iOS v1.0 free build ships with NO commercial surface — skip the web-upsell consent here too
        // (mirrors handleSubmit's guard). Without this, the guest-signup resume path re-introduces the
        // PRO email-capture screen on iOS (App Store 2.1(b)/3.1.1). Falls through to the practice route.
        if (route?.postAction === 'EMAIL_CAPTURE_UPSELL' && !PRO_UNLOCKED_FREE) {
          if (active) { setResuming(false); setShowUpsell(true) }
          return
        }
        const dest =
          route?.postAction === 'ROADMAP_ALPHABET' || route?.postAction === 'ROADMAP_NODE'
            ? '/(student)/roadmap'
            : '/(student)/speaking'
        router.replace(dest)
      } catch (e) {
        // Save failed → hydrate the form so the user can retry instead of losing their answers.
        if (active) {
          setMotivation(draft.motivation); setGoalType(draft.goalType); setCurrentLevel(draft.currentLevel)
          setTargetLevel(draft.targetLevel); setIndustry(draft.industry); setExamType(draft.examType); setDailyGoal(draft.dailyGoal)
          setResuming(false)
          Alert.alert('Chưa lưu được', apiMessage(e))
        }
      }
    })()
    return () => { active = false }
    // Intentionally keyed on isLoggedIn only: this is the one-shot resume-on-login flow.
    // draft/router/setters are read via closure and are stable for this run; adding them
    // would re-fire the resume + navigation on every render. Guarded by `active`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  async function handleSubmit() {
    if (!targetLevel) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn trình độ mục tiêu.')
      return
    }
    if (isGuest) {
      // Value-first: a guest sees a quick win + signup gate before anything is saved server-side.
      void Haptics.selectionAsync()
      setGuestQuickWin(true)
      return
    }
    setSubmitting(true)
    try {
      await api.post('/onboarding/profile', {
        goalType,
        targetLevel,
        currentLevel,
        motivation,
        ageRange: null,
        interests: [],
        industry: goalType === 'WORK' ? industry : null,
        workUseCases: [],
        examType: goalType === 'CERT' ? examType : null,
        sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
        minutesPerSession: DEFAULT_MINUTES_PER_SESSION,
        dailyGoalMinutes: parseInt(dailyGoal, 10),
        learningSpeed: 'NORMAL',
      })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      captureEvent('onboarding_completed', { goalType, targetLevel })
      captureEvent('onboarding_motivation_selected', { motivation, goalType })
      captureEvent('onboarding_daily_goal_set', { minutes: parseInt(dailyGoal, 10) })

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
      // The iOS v1.0 free build ships with NO commercial surface at all: skip this consent (it steers
      // toward a web PRO, a 2.1(b)/3.1.1 risk) and fall through to the first practice session.
      if (route?.postAction === 'EMAIL_CAPTURE_UPSELL' && !PRO_UNLOCKED_FREE) {
        setShowUpsell(true)
        return
      }
      // Roadmap archetypes → roadmap; INTERVIEW_FIRST (iOS upper levels) opens the
      // speaking screen preset to its INTERVIEW mode. Paywall actions have no mobile
      // pricing screen (reader-app), so they fall through to the first practice session.
      if (route?.postAction === 'ROADMAP_ALPHABET' || route?.postAction === 'ROADMAP_NODE') {
        router.replace('/(student)/roadmap')
      } else if (route?.postAction === 'INTERVIEW_FIRST') {
        router.replace({ pathname: '/(student)/speaking', params: { mode: 'INTERVIEW' } })
      } else {
        router.replace('/(student)/speaking')
      }
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Không lưu được', apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  // Guest signup gate: stash the funnel answers, then route to /register to save them.
  async function handleGuestSignup() {
    if (!targetLevel) return
    await saveOnboardingDraft({ motivation, goalType, currentLevel, targetLevel, industry, examType, dailyGoal })
    captureEvent('onboarding_signup_prompted', { motivation, goalType })
    router.push('/(auth)/register')
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

  if (resuming) {
    return <Resuming />
  }
  if (guestQuickWin) {
    return <GuestQuickWin mentor={mentor} onSignup={handleGuestSignup} />
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

        {/* Motivation — "why" (derives goalType) */}
        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong">Vì sao bạn học tiếng Đức?</ThemedText>
          <ChipRow
            options={MOTIVATIONS}
            selected={motivation}
            onSelect={(v) => {
              setMotivation(v)
              const picked = MOTIVATIONS.find((m) => m.value === v)
              if (picked) setGoalType(picked.goal)
            }}
          />
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

        {/* Daily goal — the streak anchor */}
        <View style={{ gap: space[3] }}>
          <ThemedText variant="bodyStrong">Mục tiêu mỗi ngày</ThemedText>
          <ChipRow options={DAILY_GOALS} selected={dailyGoal} onSelect={setDailyGoal} />
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
            Bạn có muốn nhận email gợi ý lộ trình và các tính năng nâng cao của MyDeutschFlow không?
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
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
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

/**
 * Value-first guest quick-win + signup gate. The guest answers one tiny German question
 * ("Richtig!") — the first dopamine hit — then is offered a free account to save their plan.
 */
function GuestQuickWin({ mentor, onSignup }: { mentor: OnboardingMentor | null; onSignup: () => void }) {
  const { colors } = useTheme()
  const [choice, setChoice] = useState<string | null>(null)
  const solved = choice === 'Guten Morgen'
  const OPTIONS = ['Guten Morgen', 'Gute Nacht', 'Auf Wiedersehen']
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space[6], gap: space[5] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space[2] }}>
          <ThemedText variant="display">Thử câu đầu tiên! 🇩🇪</ThemedText>
          <ThemedText variant="body" color="muted">&quot;Chào buổi sáng&quot; trong tiếng Đức là gì?</ThemedText>
        </View>
        <View style={{ gap: space[3] }}>
          {OPTIONS.map((opt) => {
            const picked = choice === opt
            const correct = opt === 'Guten Morgen'
            const showResult = choice !== null
            const borderColor = showResult && correct ? colors.success : picked ? colors.danger : colors.border
            const bg = showResult && correct ? colors.successSoft : picked ? colors.dangerSoft : colors.surface
            return (
              <Pressable
                key={opt}
                accessibilityRole="button"
                accessibilityLabel={opt}
                accessibilityState={{ selected: picked, disabled: solved }}
                disabled={solved}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setChoice(opt)
                  if (correct) captureEvent('onboarding_quickwin_completed', { correct: true })
                }}
                style={{ padding: space[4], borderRadius: radius.xl, borderWidth: 1.5, borderColor, backgroundColor: bg }}
              >
                <ThemedText variant="bodyStrong">{opt}{showResult && correct ? '  ✓' : ''}</ThemedText>
              </Pressable>
            )
          })}
        </View>
        {solved && (
          <View style={{ gap: space[3] }}>
            <ThemedText variant="bodyStrong" color="success">Richtig! 🎉 Bạn vừa học từ đầu tiên.</ThemedText>
            {mentor && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4],
                  borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.accentSoft,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                  <ThemedText variant="bodyStrong">{MENTOR_META[mentor.code]?.emoji ?? '🧑‍🏫'}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="caption" color="muted">Mentor của bạn</ThemedText>
                  <ThemedText variant="bodyStrong" color="accent">{mentor.displayName}</ThemedText>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: space[6], paddingBottom: space[2] }}>
        <Button label="Tạo tài khoản & lưu lộ trình" onPress={onSignup} disabled={!solved} />
      </View>
    </Screen>
  )
}

/** Brief loading state while a guest's saved draft is replayed after signup. */
function Resuming() {
  const { colors } = useTheme()
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[4], paddingHorizontal: space[6] }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <ThemedText variant="bodyStrong">Đang tạo lộ trình của bạn…</ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: 'center' }}>
          Lưu mục tiêu và mentor bạn vừa chọn.
        </ThemedText>
      </View>
    </Screen>
  )
}
