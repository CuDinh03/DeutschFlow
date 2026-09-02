import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import {
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  Check,
  ChevronLeft,
  Clock,
  Compass,
  FileCheck,
  GraduationCap,
  HeartPulse,
  Home,
  Monitor,
  Settings,
  ShoppingBag,
  Sparkles,
  Utensils,
  Volume2,
  Wrench,
} from 'lucide-react-native'
import api, { apiMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/useAuthStore'
import { fonts, motion, radius, space, useTheme } from '@/lib/theme'
import { captureEvent } from '@/lib/analytics'
import { saveOnboardingDraft, readOnboardingDraft, clearOnboardingDraft } from '@/lib/onboardingDraft'
import { saveDailyGoalMinutes } from '@/lib/dailyGoal'
import { MENTOR_META, mentorFirstName, type OnboardingMentor } from '@/lib/onboardingMentor'
import { nextAfterProfile } from '@/lib/onboardingRouting'
import {
  ONBOARDING_STEP_IDS,
  canLeaveStep,
  journeyEstimate,
  type OnboardingStepId,
} from '@/lib/onboardingSteps'
import { useTourStore } from '@/stores/useTourStore'
import { useBlockBackNavigation } from '@/hooks/useBlockBackNavigation'
import { BrandMark, Button, Caption, Card, Icon, Pill, Screen, SelectableChip, ThemedText, YellowSquare } from '@/components/ui'
import { MentorMonogram } from '@/components/onboarding/MentorMonogram'
import { StepHeader } from '@/components/onboarding/StepHeader'

// Onboarding for iOS B2C (MVP checklist §5.1): collect goal, target level, and
// role/industry, then POST /api/onboarding/profile and route straight into the
// first practice session.
//
// UI v2 (design 2026-09-02, docs/design/onboarding-mobile-v2): form một trang
// cuộn dài → wizard 4 bước (mục tiêu → trình độ → nhịp học → lĩnh vực/kỳ thi)
// với mentor reveal ở bước cuối. Logic submit/draft/resume/analytics GIỮ NGUYÊN
// — chỉ trình bày đổi; quyết định bước nằm ở lib/onboardingSteps.ts (có test).

type GoalType = 'WORK' | 'CERT'

/**
 * Onboarding routing decision from the backend matrix (design §4).
 * `postAction` cố ý KHÔNG khai ở đây nữa (soát 02/09, F-21 — quyết định Q-A
 * 28/08 khai tử trường này): client bỏ đọc trước, backend gỡ trường sau.
 */
interface OnboardingRoute {
  onboardingType: string
  placementRequired: boolean
  assessmentHookAfter: boolean
  paywallAllowed: boolean
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

// Current level feeds the Platform × Level matrix; A0 = absolute beginner.
// v2: A0 được CHỌN SẴN — đường mặc định phải tường minh, không còn lớp "chưa
// chạm hàng chip" mơ hồ từng che bug F-1 (QA 2026-08-20).
const CURRENT_LEVELS: { value: string; label: string }[] = [
  { value: 'A0', label: 'Mới bắt đầu · A0' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
]

const INDUSTRIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'IT', label: 'CNTT', icon: Monitor },
  { value: 'Pflege', label: 'Điều dưỡng', icon: HeartPulse },
  { value: 'Gastronomie', label: 'Nhà hàng', icon: Utensils },
  { value: 'Verkauf', label: 'Bán hàng', icon: ShoppingBag },
  { value: 'Tourismus', label: 'Du lịch', icon: Compass },
  { value: 'Technik', label: 'Kỹ thuật', icon: Settings },
]

const EXAMS: { value: string; label: string; desc: string; icon: LucideIcon }[] = [
  { value: 'GOETHE', label: 'Goethe-Zertifikat', desc: 'Chứng chỉ phổ biến nhất', icon: Award },
  { value: 'TELC', label: 'telc Deutsch', desc: 'Được công nhận ngang Goethe', icon: FileCheck },
  { value: 'TESTDAF', label: 'TestDaF', desc: 'Dành cho du học đại học', icon: GraduationCap },
]

// "Vì sao bạn học?" — the emotional anchor; derives a coarse goalType (EXAM → CERT, else WORK).
const MOTIVATIONS: { value: string; label: string; desc: string; icon: LucideIcon; goal: GoalType }[] = [
  { value: 'JOB', label: 'Đi làm tại Đức', desc: 'Việc làm, nghề nghiệp', icon: Briefcase, goal: 'WORK' },
  { value: 'AUSBILDUNG', label: 'Học nghề', desc: 'Ausbildung tại Đức', icon: Wrench, goal: 'WORK' },
  { value: 'STUDY', label: 'Du học', desc: 'Vào đại học Đức', icon: GraduationCap, goal: 'WORK' },
  { value: 'IMMIGRATION', label: 'Định cư · đoàn tụ', desc: 'Cuộc sống gia đình', icon: Home, goal: 'WORK' },
  { value: 'EXAM', label: 'Thi chứng chỉ', desc: 'Goethe · telc · TestDaF', icon: Award, goal: 'CERT' },
  { value: 'HOBBY', label: 'Sở thích', desc: 'Học cho chính mình', icon: Sparkles, goal: 'WORK' },
]

// Daily study goal (minutes) — the streak anchor.
const DAILY_GOALS: { value: string; tag: string }[] = [
  { value: '5', tag: 'Tranh thủ' },
  { value: '10', tag: 'Nhẹ nhàng' },
  { value: '15', tag: 'Đều đặn' },
  { value: '20', tag: 'Nghiêm túc' },
]

const DEFAULT_SESSIONS_PER_WEEK = 5
const DEFAULT_MINUTES_PER_SESSION = 15

export default function OnboardingScreen() {
  const theme = useTheme()
  const c = theme.colors
  const [step, setStep] = useState(0)
  const [motivation, setMotivation] = useState('JOB')
  const [goalType, setGoalType] = useState<GoalType>('WORK')   // derived from motivation
  const [dailyGoal, setDailyGoal] = useState('15')             // minutes/day — streak anchor
  const [currentLevel, setCurrentLevel] = useState<string | null>('A0')
  const [targetLevel, setTargetLevel] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [examType, setExamType] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mentor, setMentor] = useState<OnboardingMentor | null>(null)
  // Value-first auth inversion: a guest runs the funnel before signing up.
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const isGuest = !isLoggedIn
  const [guestQuickWin, setGuestQuickWin] = useState(false)   // guest: quick-win + signup gate
  const [resuming, setResuming] = useState(false)             // authed: replaying a guest draft

  const stepId: OnboardingStepId = ONBOARDING_STEP_IDS[step]
  const isLastStep = step === ONBOARDING_STEP_IDS.length - 1

  // Khách chạy phễu value-first vẫn lùi về màn Đăng nhập được; người đã đăng ký
  // thì không — lùi lúc này là rơi vào màn Đăng nhập trong khi đang đăng nhập (F-5).
  useBlockBackNavigation(isLoggedIn)

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
      // Xoá TRƯỚC khi POST không phải để tiết kiệm — đó là chốt GIÀNH QUYỀN replay.
      // register.tsx quay lại đây bằng router.replace, nên instance onboarding CŨ
      // vẫn nằm trong ngăn xếp và effect [isLoggedIn] của nó cũng bắn theo. Ai đọc
      // được draft trước thì xoá và đi tiếp; người sau đọc ra null và đứng im.
      // Đổi lại, nhánh catch phải LƯU LẠI draft (xem bên dưới) để POST hỏng không
      // làm mất trắng câu trả lời (F-10).
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
        // Cờ đặt NGAY khi hồ sơ đã lưu — trước cửa sổ dễ vỡ (màn wow). Phase D gate
        // trên (profile_done || first_sentence) nên thoát app giữa chừng không còn
        // khoá vĩnh viễn checklist tuần đầu + nhắc học (F-2).
        void useTourStore.getState().markDone('profile_done')
        captureEvent('onboarding_completed', { goalType: draft.goalType, targetLevel: draft.targetLevel })
        // Bắn đủ như nhánh authed — thiếu ở đây thì phễu lệch giữa hai đường vào
        // và không so được người dùng khách với người đăng ký thẳng (F-12).
        captureEvent('onboarding_motivation_selected', { motivation: draft.motivation, goalType: draft.goalType })
        captureEvent('onboarding_daily_goal_set', { minutes: parseInt(draft.dailyGoal, 10) })
        let route: OnboardingRoute | null = null
        try {
          const { data } = await api.get<OnboardingRoute>('/onboarding/route', {
            params: draft.currentLevel ? { currentLevel: draft.currentLevel } : undefined,
          })
          route = data
          captureEvent('onboarding_type_assigned', {
            onboardingType: data.onboardingType, paywallAllowed: data.paywallAllowed,
          })
        } catch { /* route is best-effort */ }
        // Onboarding v1 (Q1): wow "câu tiếng Đức đầu tiên" NGAY SAU signup. Màn
        // wow kết thúc tại Trang chủ — nơi spotlight tour nổ (Q4). dailyGoal lưu
        // on-device cho copy bước streak. `route` chỉ còn phục vụ analytics.
        await saveDailyGoalMinutes(parseInt(draft.dailyGoal, 10))
        void route
        router.replace(nextAfterProfile())
      } catch (e) {
        // POST hỏng → trả draft về máy. Nạp lại form chỉ cứu được user còn đang ở
        // đây; ai tắt app ngay lúc đó thì mất trắng nếu draft không được khôi phục
        // (F-10). Lưu lại cũng làm mới savedAt — user đang thao tác thật.
        //
        // TRỪ khi phiên vừa chết: 401 + refresh hỏng làm interceptor dọn sạch
        // trạng thái thiết bị rồi đá về màn đăng nhập, và rejection mới rơi xuống
        // đây. Ghi lại draft lúc đó là hồi sinh nó VỚI TTL MỚI TOANH cho một người
        // đã rời máy — đúng lỗ F-3: người kế tiếp đăng nhập trong 30 phút đó sẽ bị
        // draft này POST đè lên hồ sơ học của họ.
        if (!useAuthStore.getState().isLoggedIn) return
        await saveOnboardingDraft(draft)
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
      void useTourStore.getState().markDone('profile_done')   // xem ghi chú F-2 ở nhánh resume-draft
      // Dọn draft còn sót: ca "resume POST hỏng → form được nạp lại → user bấm
      // lưu lại" đi qua đúng nhánh này, và draft cũ không được phép replay ở lần
      // đăng nhập sau (F-10).
      void clearOnboardingDraft()
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
          paywallAllowed: data.paywallAllowed,
        })
      } catch { /* analytics/route is best-effort */ }

      // Onboarding v1 (Q1): MỌI archetype đều đi qua wow "câu tiếng Đức đầu tiên"
      // trước, rồi đáp xuống Trang chủ cho spotlight tour (Q4). Quyết định nằm ở
      // lib/onboardingRouting.ts — xem comment ở đó về lỗi F-1 (2026-08-20).
      await saveDailyGoalMinutes(parseInt(dailyGoal, 10))
      void route
      router.replace(nextAfterProfile())
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

  function advance() {
    if (!canLeaveStep(stepId, { targetLevel })) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn trình độ mục tiêu.')
      return
    }
    if (!isLastStep) {
      void Haptics.selectionAsync()
      setStep(step + 1)
      return
    }
    void handleSubmit()
  }

  function pick(update: () => void) {
    void Haptics.selectionAsync()
    update()
  }

  if (resuming) {
    return <Resuming mentor={mentor} />
  }
  if (guestQuickWin) {
    return <GuestQuickWin mentor={mentor} onSignup={handleGuestSignup} onBack={() => setGuestQuickWin(false)} />
  }

  const focusIsWork = goalType === 'WORK'
  const showSkip = isLastStep && (focusIsWork ? !industry : !examType)
  const estimate = journeyEstimate(currentLevel, targetLevel)

  return (
    <Screen edges={['top', 'bottom']}>
      <StepHeader step={step} onBack={step > 0 ? () => setStep(step - 1) : null} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[4], paddingBottom: space[8] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotiView
          key={step}
          from={{ opacity: 0, translateX: 26 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: motion.duration.normal }}
          style={{ gap: space[5] }}
        >
          {stepId === 'motivation' && (
            <>
              <TitleBlock cap="Bước 1 / 4 · Mục tiêu" title="Vì sao bạn học tiếng Đức?" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: -space[2] }}>
                <YellowSquare />
                <ThemedText variant="caption" color="secondary">
                  Chưa cần tài khoản — trả lời trong khoảng 1 phút.
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                {MOTIVATIONS.map((m) => (
                  <OptionTile
                    key={m.value}
                    label={m.label}
                    desc={m.desc}
                    icon={m.icon}
                    selected={motivation === m.value}
                    onPress={() =>
                      pick(() => {
                        setMotivation(m.value)
                        setGoalType(m.goal)
                      })
                    }
                  />
                ))}
              </View>
            </>
          )}

          {stepId === 'levels' && (
            <>
              <TitleBlock cap="Bước 2 / 4 · Trình độ" title="Bạn đang ở đâu — và muốn tới đâu?" />
              <View style={{ gap: space[3] }}>
                <Caption>Hiện tại</Caption>
                <LevelChips options={CURRENT_LEVELS} selected={currentLevel} onSelect={(v) => pick(() => setCurrentLevel(v))} />
              </View>
              <View style={{ gap: space[3] }}>
                <Caption>Mục tiêu</Caption>
                <LevelChips
                  options={LEVELS.map((l) => ({ value: l, label: l }))}
                  selected={targetLevel}
                  onSelect={(v) => pick(() => setTargetLevel(v))}
                />
              </View>
              {targetLevel ? (
                <Card style={{ gap: space[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <View style={{ alignItems: 'center', gap: space[1] }}>
                      <ThemedText variant="monoLg">{currentLevel ?? 'A0'}</ThemedText>
                      <Caption color={c.textMuted}>Hôm nay</Caption>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <YellowSquare />
                      <View style={{ flex: 1, height: 2, backgroundColor: c.borderStrong }} />
                      <Icon icon={ArrowRight} size={16} color="accent" />
                    </View>
                    <View style={{ alignItems: 'center', gap: space[1] }}>
                      <ThemedText variant="monoLg" color="accent">
                        {targetLevel}
                      </ThemedText>
                      <Caption color={c.textMuted}>Mục tiêu</Caption>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[2],
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                      paddingTop: space[3],
                    }}
                  >
                    <Icon icon={Clock} size={15} color="secondary" />
                    <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
                      {estimate
                        ? `Lộ trình ${estimate.nodes} chặng · khoảng ${estimate.weeks} tuần với nhịp đều đặn.`
                        : 'Lộ trình sẽ được dựng riêng cho chặng này của bạn.'}
                    </ThemedText>
                  </View>
                </Card>
              ) : null}
            </>
          )}

          {stepId === 'rhythm' && (
            <>
              <TitleBlock
                cap="Bước 3 / 4 · Nhịp học"
                title="Mỗi ngày bao nhiêu phút?"
                sub="Chuỗi ngày học (streak) tính theo mức này — chọn mức bạn giữ được lâu dài."
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                {DAILY_GOALS.map((g) => (
                  <MinuteTile
                    key={g.value}
                    minutes={g.value}
                    tag={g.tag}
                    selected={dailyGoal === g.value}
                    onPress={() => pick(() => setDailyGoal(g.value))}
                  />
                ))}
              </View>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <IconTile icon={Bell} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">Nhắc học 20:00 mỗi tối</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    Bật sau khi tạo tài khoản — đổi giờ được trong Cài đặt.
                  </ThemedText>
                </View>
              </Card>
            </>
          )}

          {stepId === 'focus' && (
            <>
              {focusIsWork ? (
                <>
                  <TitleBlock
                    cap="Bước 4 / 4 · Lĩnh vực"
                    title="Bạn sẽ dùng tiếng Đức ở đâu?"
                    sub="Không bắt buộc — giúp chọn mentor và tình huống luyện nói sát nghề."
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                    {INDUSTRIES.map((it) => (
                      <IndustryTile
                        key={it.value}
                        label={it.label}
                        icon={it.icon}
                        selected={industry === it.value}
                        onPress={() => pick(() => setIndustry(industry === it.value ? null : it.value))}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <TitleBlock
                    cap="Bước 4 / 4 · Kỳ thi"
                    title="Bạn nhắm kỳ thi nào?"
                    sub="Không bắt buộc — đề luyện và dạng bài sẽ bám theo format kỳ thi này."
                  />
                  <View style={{ gap: space[3] }}>
                    {EXAMS.map((ex) => (
                      <ExamRow
                        key={ex.value}
                        label={ex.label}
                        desc={ex.desc}
                        icon={ex.icon}
                        selected={examType === ex.value}
                        onPress={() => pick(() => setExamType(examType === ex.value ? null : ex.value))}
                      />
                    ))}
                  </View>
                </>
              )}
              {mentor ? <MentorRevealCard mentor={mentor} /> : null}
            </>
          )}
        </MotiView>
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space[6],
          paddingTop: space[4],
          paddingBottom: space[2],
        }}
      >
        {showSkip ? (
          <Button label="Bỏ qua" variant="secondary" fullWidth={false} onPress={advance} />
        ) : null}
        <Button
          label={isLastStep ? 'Tạo lộ trình của tôi' : 'Tiếp tục'}
          onPress={advance}
          loading={submitting}
          disabled={stepId === 'levels' && !targetLevel}
          fullWidth={false}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  )
}

// ── Wizard building blocks ─────────────────────────────────────────────────────

function TitleBlock({ cap, title, sub }: { cap: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: space[2] }}>
      <Caption>{cap}</Caption>
      <ThemedText variant="display">{title}</ThemedText>
      {sub ? (
        <ThemedText variant="body" color="secondary">
          {sub}
        </ThemedText>
      ) : null}
    </View>
  )
}

/** Chấm radio Galerie: vòng hairline → đĩa gold + check trắng khi chọn. */
function RadioDot({ selected, color }: { selected: boolean; color?: 'accent' | 'success' }) {
  const c = useTheme().colors
  const fill = color === 'success' ? c.success : c.accentText
  return (
    <View
      style={{
        width: 21,
        height: 21,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: selected ? fill : c.border,
        backgroundColor: selected ? fill : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon icon={Check} size={12} color="onInk" strokeWidth={3.2} /> : null}
    </View>
  )
}

/** Ô icon 40px nền giấy chìm (hoặc mực khi selected) cho các hàng/tile. */
function IconTile({ icon, selected = false, size = 40 }: { icon: LucideIcon; selected?: boolean; size?: number }) {
  const c = useTheme().colors
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: selected ? c.inkSurface : c.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon icon={icon} size={Math.round(size * 0.5)} color={selected ? 'accent' : 'secondary'} strokeWidth={1.8} />
    </View>
  )
}

function OptionTile({
  label,
  desc,
  icon,
  selected,
  onPress,
}: {
  label: string
  desc: string
  icon: LucideIcon
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={`${label} — ${desc}`}
      selected={selected}
      onPress={onPress}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: space[2],
        padding: space[3] + 2,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <IconTile icon={icon} selected={selected} size={38} />
        <RadioDot selected={selected} />
      </View>
      <View style={{ gap: 2 }}>
        <ThemedText style={{ fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 20 }}>{label}</ThemedText>
        <ThemedText variant="caption" color="secondary">
          {desc}
        </ThemedText>
      </View>
    </SelectableChip>
  )
}

function LevelChips({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[]
  selected: string | null
  onSelect: (value: string) => void
}) {
  const c = useTheme().colors
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((opt) => {
        const active = selected === opt.value
        return (
          <SelectableChip
            key={opt.value}
            label={opt.label}
            selected={active}
            onPress={() => onSelect(opt.value)}
            style={{
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? c.accentText : c.border,
              backgroundColor: active ? c.accentSoft : c.surface,
            }}
          >
            <ThemedText variant="bodyStrong" color={active ? 'primary' : 'secondary'}>
              {opt.label}
            </ThemedText>
          </SelectableChip>
        )
      })}
    </View>
  )
}

function MinuteTile({
  minutes,
  tag,
  selected,
  onPress,
}: {
  minutes: string
  tag: string
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={`${minutes} phút mỗi ngày — ${tag}`}
      selected={selected}
      onPress={onPress}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: space[1],
        padding: space[4],
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
          <ThemedText variant="monoLg">{minutes}</ThemedText>
          <ThemedText variant="caption" color="secondary">
            phút
          </ThemedText>
        </View>
        {selected ? <RadioDot selected /> : null}
      </View>
      <ThemedText variant="caption" color={selected ? 'primary' : 'secondary'}>
        {tag}
      </ThemedText>
    </SelectableChip>
  )
}

function IndustryTile({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string
  icon: LucideIcon
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={label}
      selected={selected}
      onPress={onPress}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[3] + 2,
        paddingVertical: space[3] + 1,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <Icon icon={icon} size={19} color={selected ? 'primary' : 'secondary'} strokeWidth={1.8} />
      <ThemedText variant="label" color={selected ? 'primary' : 'secondary'}>
        {label}
      </ThemedText>
    </SelectableChip>
  )
}

function ExamRow({
  label,
  desc,
  icon,
  selected,
  onPress,
}: {
  label: string
  desc: string
  icon: LucideIcon
  selected: boolean
  onPress: () => void
}) {
  const c = useTheme().colors
  return (
    <SelectableChip
      label={`${label} — ${desc}`}
      selected={selected}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[4],
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accentText : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <IconTile icon={icon} selected={selected} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 20 }}>{label}</ThemedText>
        <ThemedText variant="caption" color="secondary">
          {desc}
        </ThemedText>
      </View>
      <RadioDot selected={selected} />
    </SelectableChip>
  )
}

/** Mentor reveal — đỉnh cảm xúc của phễu: thẻ viền gold + monogram + lời hứa. */
function MentorRevealCard({ mentor }: { mentor: OnboardingMentor }) {
  const c = useTheme().colors
  const tagline = MENTOR_META[mentor.code]?.tagline ?? 'Người đồng hành học tập'
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: motion.duration.normal }}
      style={{
        borderWidth: 2,
        borderColor: c.accentText,
        borderRadius: radius.md,
        backgroundColor: c.accentSoft,
        padding: space[4],
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Caption color={c.accentText}>Mentor của bạn</Caption>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <YellowSquare size={6} color={c.inkSurface} />
          <YellowSquare size={6} color={c.brand} />
          <YellowSquare size={6} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <MentorMonogram mentor={mentor} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="titleLg">{mentorFirstName(mentor)}</ThemedText>
          <ThemedText variant="caption" color="secondary">
            {tagline}
          </ThemedText>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingTop: space[3],
        }}
      >
        <Icon icon={Volume2} size={16} color="secondary" strokeWidth={1.8} />
        <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
          Sẽ chào bạn bằng tiếng Đức ngay khi lộ trình sẵn sàng — và cùng bạn luyện nói từ buổi đầu.
        </ThemedText>
      </View>
    </MotiView>
  )
}

// ── Sub-screens ────────────────────────────────────────────────────────────────

/**
 * Value-first guest quick-win + signup gate. The guest answers one tiny German question
 * ("Richtig!") — the first dopamine hit — then is offered a free account to save their plan.
 */
function GuestQuickWin({
  mentor,
  onSignup,
  onBack,
}: {
  mentor: OnboardingMentor | null
  onSignup: () => void
  onBack: () => void
}) {
  const c = useTheme().colors
  const [choice, setChoice] = useState<string | null>(null)
  const solved = choice === 'Guten Morgen'
  const OPTIONS = ['Guten Morgen', 'Gute Nacht', 'Auf Wiedersehen']
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: space[5] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại các câu hỏi"
          hitSlop={10}
          onPress={onBack}
          style={{ marginLeft: -space[2], padding: space[1] }}
        >
          <Icon icon={ChevronLeft} size={26} color="primary" />
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[8], gap: space[5] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TitleBlock cap="Trước khi lưu · Thử nhanh" title="Thử câu đầu tiên!" sub="„Chào buổi sáng“ trong tiếng Đức là gì?" />
        <View style={{ gap: space[3] }}>
          {OPTIONS.map((opt) => {
            const picked = choice === opt
            const correct = opt === 'Guten Morgen'
            const showResult = choice !== null
            const isRight = showResult && correct
            const isWrongPick = picked && !correct
            return (
              <SelectableChip
                key={opt}
                label={opt}
                selected={picked}
                disabled={solved}
                onPress={() => {
                  void Haptics.selectionAsync()
                  setChoice(opt)
                  if (correct) captureEvent('onboarding_quickwin_completed', { correct: true })
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[4],
                  borderRadius: radius.md,
                  borderWidth: isRight || isWrongPick ? 2 : 1,
                  borderColor: isRight ? c.success : isWrongPick ? c.danger : c.border,
                  backgroundColor: isRight ? c.successSoft : isWrongPick ? c.dangerSoft : c.surface,
                }}
              >
                <RadioDot selected={isRight} color="success" />
                <ThemedText variant="bodyStrong" color={isRight ? 'primary' : 'secondary'} style={{ flex: 1 }}>
                  {opt}
                </ThemedText>
                {isRight ? <Pill label="Đúng" tone="success" solid /> : null}
              </SelectableChip>
            )
          })}
        </View>
        {solved && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: motion.duration.normal }}
            style={{ gap: space[4] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.full,
                  backgroundColor: c.successSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={Check} size={22} color="success" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="titleLg" color="success">
                  Richtig!
                </ThemedText>
                <ThemedText variant="caption" color="secondary">
                  Bạn vừa học câu chào tiếng Đức đầu tiên.
                </ThemedText>
              </View>
            </View>
            {mentor && (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <MentorMonogram mentor={mentor} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="bodyStrong">{`${mentorFirstName(mentor)} đang chờ bạn`}</ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    Buổi luyện nói đầu tiên đã xếp sẵn trong lộ trình của bạn.
                  </ThemedText>
                </View>
              </Card>
            )}
          </MotiView>
        )}
      </ScrollView>
      <View
        style={{
          gap: space[2],
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
          paddingHorizontal: space[6],
          paddingTop: space[4],
          paddingBottom: space[2],
        }}
      >
        <Button label="Tạo tài khoản & lưu lộ trình" onPress={onSignup} disabled={!solved} />
        <ThemedText variant="caption" color="secondary" align="center">
          Miễn phí — lộ trình, mentor và kết quả được giữ nguyên.
        </ThemedText>
      </View>
    </Screen>
  )
}

/** Brief loading state while a guest's saved draft is replayed after signup. */
function Resuming({ mentor }: { mentor: OnboardingMentor | null }) {
  const c = useTheme().colors
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[5], paddingHorizontal: space[6] }}>
        {mentor ? <MentorMonogram mentor={mentor} size={64} /> : null}
        <ActivityIndicator size="large" color={c.accent} />
        <View style={{ alignItems: 'center', gap: space[2] }}>
          <ThemedText variant="titleLg" align="center">
            Đang tạo lộ trình của bạn…
          </ThemedText>
          <ThemedText variant="caption" color="secondary" align="center">
            Chỉ vài giây — đừng đóng ứng dụng.
          </ThemedText>
        </View>
        <Card padded={false} style={{ alignSelf: 'stretch' }}>
          <StageRow label="Lưu mục tiêu & trình độ" delay={300} />
          <StageRow label="Ghép mentor đồng hành" delay={1000} />
          <StageRow label="Dựng lộ trình học…" delay={0} spinning last />
        </Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], opacity: 0.65 }}>
          <BrandMark size={18} />
          <Caption>DeutschFlow</Caption>
        </View>
      </View>
    </Screen>
  )
}

/** Một dòng "giai đoạn" trong màn tạo lộ trình — thuần trình diễn, check hiện dần. */
function StageRow({
  label,
  delay,
  spinning = false,
  last = false,
}: {
  label: string
  delay: number
  spinning?: boolean
  last?: boolean
}) {
  const c = useTheme().colors
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[4],
        paddingVertical: space[3] + 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      {spinning ? (
        <ActivityIndicator size="small" color={c.accentText} />
      ) : (
        <MotiView
          from={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: motion.duration.normal, delay }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.full,
              backgroundColor: c.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Check} size={12} color="onInk" strokeWidth={3.2} />
          </View>
        </MotiView>
      )}
      <ThemedText variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </ThemedText>
    </View>
  )
}
