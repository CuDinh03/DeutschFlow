// Màn Hôm nay (giao diện v3.4; mẫu `plans/ios-v3.4-mau` màn `today`). Đợt 2: thẻ "Lịch ôn hôm nay"
// đứng đầu. Đợt 2b (19/11/2026): thanh đầu có chuỗi ngày dạng huy hiệu (neo tour `homeStreak`) và nút
// Hướng dẫn chạy lại tour, lời chào có vệt vàng, thẻ phỏng vấn theo nghề, hai ô nhanh, "Tiếp tục học".
import { useCallback, useEffect, useState } from 'react'
import { View, Alert, Linking } from 'react-native'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, useFocusEffect } from 'expo-router'
import { MotiView } from 'moti'
import { useAuthStore } from '@/stores/useAuthStore'
import { isTrialActive, usePlanStore } from '@/stores/usePlanStore'
import { useTourStore } from '@/stores/useTourStore'
import { canAutoStartHomeTour, canAutoStartSrsIntro, probeStatus } from '@/lib/tourEligibility'
import { useStarterStore } from '@/stores/useStarterStore'
import { SpotlightTarget, useSpotlightTour } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'
import { StarterChecklist } from '@/components/guide/StarterChecklist'
import { ReminderSheet } from '@/components/guide/ReminderSheet'
import { getDailyGoalMinutes } from '@/lib/dailyGoal'
import { enableStudyReminder, REMINDER_HOUR } from '@/lib/studyReminder'
import { profileApi } from '@/lib/profileApi'
import { recordCoreDone } from '@/lib/activation'
import { registerPushTokenIfGranted } from '@/hooks/usePushNotifications'
import { captureEvent } from '@/lib/analytics'
import api from '@/lib/api'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { lernwegApi, ROADMAP_ME_QUERY_KEY } from '@/lib/lernwegApi'
import { EXAM_HUB_QUERY_KEY } from '@/hooks/useExamHub'
import { messagesApi } from '@/lib/messagesApi'
import { TodayTasks } from '@/components/home/TodayTasks'
import { TodayPlanCard } from '@/components/exam/hub/TodayPlanCard'
import { ContinueLearning, InterviewCard, QuickTiles } from '@/components/home/TodayCards'
import { RoundIconButton } from '@/components/home/RoundIconButton'
import { useExamHub } from '@/hooks/useExamHub'
import { greetingName, roadmapRange, todayDateLine } from '@/lib/homeToday'
import { CircleHelp } from 'lucide-react-native'
import { motion, space, radius, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Pill,
  Skeleton,
  ErrorState,
  useTabBarClearance,
  AvatarButton,
  BrandMark,
  BrushMark,
GaGlyph } from '@/components/ui'

// Only the fields the home actually uses from the (plan-oriented) dashboard.
// XP/level come from /xp/me, SRS due + reviewedCards from /srs/stats, unread from /notifications.
interface DashboardData {
  streakDays: number
  weeklyXp: number
}

export default function DashboardScreen() {
  const theme = useTheme()
  // Thanh tab liquid-glass nổi đè lên nội dung — chừa đáy cho mục cuối.
  const tabClearance = useTabBarClearance()
  const { user } = useAuthStore()
  const { isPro, plan } = usePlanStore()
  // M-7 (Q1 28/08): đang dùng thử thì KHÔNG chủ động mời nâng cấp — thẻ upsell dưới đây ẩn.
  const trialActive = isTrialActive(plan)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/student/dashboard').then((r) => r.data),
    staleTime: 60_000,
  })

  const {
    data: xp,
    refetch: refetchXp,
    isSuccess: xpLoaded,
    isError: xpFailed,
  } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })

  const {
    data: srs,
    refetch: refetchSrs,
    isSuccess: srsLoaded,
    isError: srsFailed,
  } = useQuery({
    queryKey: ['srs-count'],
    // /srs/stats thay /srs/count (05/09): cùng dueCount, thêm reviewedCards (số thẻ đã
    // ôn ≥ 1 lần) để coach mark SRS chỉ tự nổ cho người CHƯA TỪNG ôn. Backend cũ chưa
    // trả trường này → undefined → tourEligibility rơi về gate cũ.
    queryFn: () => api.get<{ dueCount: number; reviewedCards?: number }>('/srs/stats').then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count').then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: msgUnread = 0, refetch: refetchMsgUnread } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: () => messagesApi.unreadCount(),
    staleTime: 30_000,
  })

  // Tiến độ lộ trình: CÙNG nguồn /roadmap/me với màn Lernweg (N1, 05/09) — trước đây
  // card lấy % từ /skill-tree/me còn màn đích vẽ cây demo /roadmap/tree nên hai số
  // không bao giờ khớp nhau.
  const {
    data: roadmapNodes = [],
    isSuccess: roadmapLoaded,
    isError: roadmapFailed,
  } = useQuery({
    queryKey: ROADMAP_ME_QUERY_KEY,
    queryFn: () => lernwegApi.nodes(),
    staleTime: 120_000,
  })
  const treeTotal = roadmapNodes.length
  const treeDone = roadmapNodes.filter((n) => n.progressStatus === 'COMPLETED' || n.state === 'completed').length
  const pathPct = treeTotal > 0 ? Math.round((treeDone / treeTotal) * 100) : 0

  // Khai báo trước các gate tour: đang kéo-làm-mới thì RefreshControl đè lên
  // scrollTo/đo neo của spotlight → coach mark nổ đúng lúc đó rơi về tooltip giữa
  // màn không khoét sáng (F-SRS-COACH-01, QA tài khoản mới 05/09). Gate coi
  // `refreshing` là bận, làm mới xong effect chạy lại và nổ bình thường.
  const queryClient = useQueryClient()
  const pull = usePullRefresh(async () => {
    // Cả các khối mới của Hôm nay (lịch ôn / ô Thi thử dựa trên exam-hub, ô Lộ trình dựa trên roadmap).
    await Promise.all([
      refetch(), refetchXp(), refetchSrs(), refetchUnread(), refetchMsgUnread(),
      queryClient.invalidateQueries({ queryKey: EXAM_HUB_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ROADMAP_ME_QUERY_KEY }),
    ])
  })

  const { startTour, activeTourId } = useSpotlightTour()
  const tourHydrated = useTourStore((s) => s.hydrated)
  const tourDone = useTourStore((s) => s.done)
  const dueForIntro = srs?.dueCount ?? 0

  // Q4 (plan onboarding v1): tour spotlight chỉ nổ khi user đáp xuống Trang chủ
  // lần đầu (sau wow moment), delay ~500ms — không auto-mở đè app như tour cũ.
  // Owner 05/09: CHỈ tự nổ với tài khoản MỚI đăng ký (chưa có hoạt động: 0 XP,
  // 0 chặng hoàn thành — tín hiệu server, lib/tourEligibility). Cờ "đã xem" nằm
  // trong SecureStore theo máy và bị xoá khi đăng xuất, nên trước đây tài khoản
  // cũ đăng nhập lại hoặc sang máy mới bị tour đè lên. Xem lại theo ý muốn vẫn
  // qua Hướng dẫn (replay).
  const homeTourAllowed = canAutoStartHomeTour({
    hydrated: tourHydrated,
    doneHome: tourDone.home,
    tourBusy: activeTourId !== null,
    refreshing: pull.refreshing,
    // Chờ dashboard render xong: bước 1 neo vào thẻ chuỗi học, mà thẻ đó chỉ
    // tồn tại khi hết isLoading. Mạng chậm thì waitForRect (1.8s) hết hạn và
    // tour rơi về "màn mờ phẳng + tooltip giữa màn", mất hiệu ứng khoét sáng (F-11).
    dashboardLoading: isLoading,
    xp: { status: probeStatus(xpLoaded, xpFailed), totalXp: xp?.totalXp ?? 0 },
    roadmap: { status: probeStatus(roadmapLoaded, roadmapFailed), completedCount: treeDone },
  })
  useFocusEffect(
    useCallback(() => {
      if (!homeTourAllowed) return
      const t = setTimeout(() => {
        void getDailyGoalMinutes().then((m) => startTour('home', 'auto', { dailyGoalMinutes: m }))
      }, 500)
      return () => clearTimeout(t)
    }, [homeTourAllowed, startTour]),
  )

  // ── Tuần đầu (Phase D): checklist "Bắt đầu" + sheet nhắc học 20:00 ─────────
  const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [goalMinutes, setGoalMinutes] = useState<number | null>(null)
  const starterHydrated = useStarterStore((s) => s.hydrated)
  const reminderEnabled = useStarterStore((s) => s.reminderEnabled)
  const reminderDeclinedAt = useStarterStore((s) => s.reminderDeclinedAt)
  const starterSrsReviews = useStarterStore((s) => s.srsReviews)
  const speakingStarted = useStarterStore((s) => s.speakingSessionStarted)

  useEffect(() => {
    void useStarterStore.getState().hydrate()
    void getDailyGoalMinutes().then(setGoalMinutes)
  }, [])

  // Q3: coach mark SRS tách khỏi tour chính — bắn 1 lần khi thẻ "Ôn tập hôm nay"
  // render thật (dueSrs > 0). Owner 05/09: chỉ cho người CHƯA TỪNG ôn — tín hiệu
  // server /srs/stats reviewedCards === 0 (lib/tourEligibility); backend chưa có
  // trường thì rơi về gate cũ "tour chính đã xem trên máy này".
  const reviewedCards = srs?.reviewedCards
  useFocusEffect(
    useCallback(() => {
      const allowed = canAutoStartSrsIntro({
        hydrated: tourHydrated,
        doneHome: tourDone.home,
        doneSrs: tourDone.srs_intro,
        tourBusy: activeTourId !== null,
        refreshing: pull.refreshing,
        sheetOpen: reminderOpen,
        dueCount: dueForIntro,
        reviewed: { status: probeStatus(srsLoaded, srsFailed), count: reviewedCards ?? null },
      })
      if (!allowed) return
      const t = setTimeout(() => startTour('srs_intro', 'auto', { dueCount: dueForIntro }), 600)
      return () => clearTimeout(t)
    }, [
      tourHydrated,
      tourDone.home,
      tourDone.srs_intro,
      activeTourId,
      reminderOpen,
      pull.refreshing,
      dueForIntro,
      srsLoaded,
      srsFailed,
      reviewedCards,
      startTour,
    ]),
  )

  const firstActivityDone = treeDone > 0 || starterSrsReviews > 0 || speakingStarted
  // Cửa vào Phase D (checklist tuần đầu + sheet nhắc học). OR chứ không chỉ
  // first_sentence: cờ đó đặt ở CUỐI màn wow, mà lối vào lại màn wow nằm trong
  // chính checklist bị nó khoá — thoát app giữa chừng là khoá vĩnh viễn (F-2).
  // first_sentence giữ trong biểu thức để tài khoản tạo trước bản vá không mất gì.
  const onboardedV1 = tourDone.profile_done || tourDone.first_sentence

  // §7.2: pre-permission — sheet ngữ cảnh chỉ SAU khi user hoàn thành hoạt động
  // đầu tiên, không xin quyền lúc mở app. Từ chối sheet → hỏi lại sau cooldown.
  useFocusEffect(
    useCallback(() => {
      if (!starterHydrated || !tourHydrated || !onboardedV1) return
      if (reminderEnabled || reminderOpen || activeTourId || !firstActivityDone) return
      if (reminderDeclinedAt && Date.now() - reminderDeclinedAt < REMINDER_COOLDOWN_MS) return
      const t = setTimeout(() => {
        captureEvent('onb_reminder_sheet_shown', { trigger: 'auto' })
        captureEvent('reminder_prompt_shown', { trigger: 'auto' })
        setReminderOpen(true)
      }, 900)
      return () => clearTimeout(t)
    }, [
      starterHydrated,
      tourHydrated,
      onboardedV1,
      reminderEnabled,
      reminderOpen,
      activeTourId,
      firstActivityDone,
      reminderDeclinedAt,
      REMINDER_COOLDOWN_MS,
    ]),
  )

  // CORE_DONE (spec §2.1, I-4): trả lời sheet nhắc học — bật HAY từ chối — là đi hết luồng
  // onboarding. Chỉ lần trả lời ĐẦU TIÊN mới tính; server idempotent nên gọi thừa cũng vô hại.
  function markCoreDoneIfFirstAnswer() {
    if (reminderEnabled || reminderDeclinedAt) return
    captureEvent('onboarding_core_completed', {})
    void recordCoreDone()
  }

  async function acceptReminder() {
    setReminderBusy(true)
    markCoreDoneIfFirstAnswer()
    const outcome = await enableStudyReminder(goalMinutes)
    setReminderBusy(false)
    setReminderOpen(false)

    if (outcome === 'granted') {
      useStarterStore.getState().markReminderEnabled()
      // Đợt 6 (§4.7 M10): cho server biết giờ nhắc để nhắc chuỗi + lifecycle đúng giờ này thay 18h.
      // Best-effort — lịch cục bộ 20:00 đã đặt xong ở trên; server hỏng thì lần bật sau ghi lại.
      profileApi.update({ reminderHourLocal: REMINDER_HOUR }).catch(() => undefined)
      // Quyền vừa được cấp → lấy push token luôn. Không gọi ở đây thì thiết bị
      // phải chờ tới lần đăng nhập kế tiếp mới đăng ký được (F-14).
      void registerPushTokenIfGranted()
      return
    }

    // Vào cooldown ở cả 2 nhánh còn lại, không hỏi dồn dập.
    useStarterStore.getState().declineReminderSheet(Date.now())

    if (outcome === 'blocked') {
      // OS không cho hỏi nữa — hỏi lại là vô nghĩa, phải chỉ đường vào Cài đặt.
      Alert.alert(
        'Thông báo đang tắt',
        'Bạn đã tắt thông báo cho MyDeutschFlow. Mở Cài đặt để bật lại thì mới nhắc học buổi tối được nhé.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => void Linking.openSettings() },
        ],
      )
    }
  }

  function declineReminder() {
    markCoreDoneIfFirstAnswer()
    captureEvent('onb_reminder_sheet_dismissed', {})
    useStarterStore.getState().declineReminderSheet(Date.now())
    setReminderOpen(false)
  }

  const firstName = greetingName(user?.displayName)
  const dueSrs = srs?.dueCount ?? 0
  const unread = unreadData?.unreadCount ?? 0
  // Lời chào theo mẫu: "ôn telc" khi tài khoản luyện được đề telc (mặc định cho mọi tài khoản từ
  // 07/11); dữ liệu Luyện thi đã tải mà chưa mở luyện đề thì nói chung là học tiếng Đức.
  const hub = useExamHub()
  const markWord = hub.data && !hub.data.access ? 'học tiếng Đức' : 'ôn telc'
  const roadmapTile =
    treeTotal > 0 ? { pct: pathPct, done: treeDone, total: treeTotal, range: roadmapRange(roadmapNodes) } : null

  const onRefresh = () => void pull.onRefresh()

  // Nút "?" trên thanh đầu (mẫu `t-help`): chạy lại tour Trang chủ như nút trong màn Hướng dẫn.
  const replayTour = () => {
    if (activeTourId) return
    captureEvent('guide_tour_replay_clicked', { from: 'home_header' })
    void getDailyGoalMinutes().then((m) => startTour('home', 'replay', { dailyGoalMinutes: m }))
  }

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingBottom: tabClearance }}
      refreshing={pull.refreshing}
      onRefresh={onRefresh}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: space[5],
          paddingTop: space[2],
        }}
      >
        <BrandMark size={30} />
        <View style={{ flex: 1 }} />
        {/* Chuỗi ngày học dạng huy hiệu (mẫu `t-streak`) — bước 1 của tour Trang chủ neo vào đây. */}
        {data ? (
          <SpotlightTarget id={SPOTLIGHT_TARGETS.homeStreak}>
            <StreakBadge days={data.streakDays ?? 0} />
          </SpotlightTarget>
        ) : null}
        <RoundIconButton
          icon={CircleHelp}
          label="Xem hướng dẫn"
          hint="Chạy lại tour chỉ chỗ từng phần trên màn hình"
          onPress={replayTour}
        />
        <RoundIconButton
          glyph="hoithoai"
          label={msgUnread > 0 ? `Tin nhắn, ${msgUnread} chưa đọc` : 'Tin nhắn'}
          badge={msgUnread}
          onPress={() => router.push('/(student)/messages')}
        />
        <RoundIconButton
          glyph="thongbao"
          label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
          badge={unread}
          onPress={() => router.push('/(student)/notifications')}
        />
        <AvatarButton />
      </View>

      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${todayDateLine(new Date())}. Chào ${firstName}, ${markWord} hôm nay.`}
        style={{ paddingHorizontal: space[5], marginTop: space[5] }}
      >
        <ThemedText variant="label" color="muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
          {todayDateLine(new Date())}
        </ThemedText>
        <ThemedText variant="display" style={{ marginTop: space[1] }}>{`Chào ${firstName},`}</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <BrushMark>{markWord}</BrushMark>
          <ThemedText variant="display"> hôm nay.</ThemedText>
        </View>
      </View>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError && !data ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: motion.duration.normal }}
        >
          {/* Owner chốt 18/11 (giữ 19/11): lịch ôn telc đứng đầu màn Hôm nay; chưa có ngày thi thì
              mời làm bài chẩn đoán. Tự ẩn khi tài khoản chưa mở luyện đề. */}
          <TodayPlanCard dueSrs={dueSrs} style={{ marginHorizontal: space[5], marginTop: space[5] }} />

          {/* Mẫu `t-interview` + `t-tiles`: phỏng vấn theo nghề, rồi hai ô Thi thử trọn đề / Lộ trình.
              Ô Lộ trình cùng nguồn /roadmap/me với màn Lernweg (N1, 05/09). */}
          <View style={{ paddingHorizontal: space[5], marginTop: space[4], gap: space[3] }}>
            <InterviewCard />
            <QuickTiles roadmap={roadmapTile} />
          </View>

          {/* Tuần đầu (§7.1): checklist "Bắt đầu" — chỉ cho user đã qua onboarding v1,
              tự biến mất vĩnh viễn khi hoàn thành đủ. */}
          {onboardedV1 ? (
            <StarterChecklist
              lessonDone={treeDone > 0}
              onEnableReminder={() => {
                captureEvent('onb_reminder_sheet_shown', { trigger: 'checklist' })
                captureEvent('reminder_prompt_shown', { trigger: 'checklist' })
                setReminderOpen(true)
              }}
            />
          ) : null}

          {/* Heute (cụm 2, thiết kế 02/09): việc hôm nay từ /today/me — sửa lỗi
              đến hạn + nói/từ vựng theo gợi ý. Thẻ Ôn SRS ngay dưới là "việc"
              thứ tư, giữ nguyên vì nó là mỏ neo tour (homeSrsCard). */}
          <TodayTasks />

          {dueSrs > 0 ? (
            // Lề đặt trên neo, không trên Card: neo đo đúng thẻ nên khung vàng của
            // tour SRS ôm sát thẻ thay vì ôm cả lề màn hình (QA 05/09).
            <SpotlightTarget
              id={SPOTLIGHT_TARGETS.homeSrsCard}
              style={{ marginHorizontal: space[5], marginTop: space[4] }}
            >
            <Card
              onPress={() => router.push('/(student)/srs')}
              bordered
              style={{ borderColor: theme.colors.accentSoft }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: theme.colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GaGlyph name="hoc" size={20} ink="primary" />
                  </View>
                  <View style={{ gap: 2 }}>
                    <ThemedText variant="bodyStrong">Ôn tập hôm nay</ThemedText>
                    <ThemedText variant="caption" color="muted">
                      Spaced repetition đến hạn
                    </ThemedText>
                  </View>
                </View>
                <Pill label={`${dueSrs} thẻ`} tone="accent" />
              </View>
            </Card>
            </SpotlightTarget>
          ) : null}

          <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
            <ContinueLearning nodes={roadmapNodes} />
          </View>

          {!isPro && !trialActive && PAYWALL_ENABLED ? (
            <Card
              onPress={() => router.push('/(student)/upgrade')}
              elevation="lifted"
              style={{ marginHorizontal: space[5], marginTop: space[6], borderColor: theme.colors.accentSoft }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
                <View style={{ flex: 1, gap: space[1] }}>
                  <Pill label="MyDeutschFlow PRO" tone="accent" glyph="goipro" />
                  <ThemedText variant="title">Mở khoá toàn bộ tính năng</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    Luyện nói AI, thi thử, thử thách tuần
                  </ThemedText>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.accent,
                    borderRadius: radius.md,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                  }}
                >
                  <ThemedText variant="label" color="onAccent">
                    Xem PRO
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}
        </MotiView>
      )}

      <ReminderSheet
        visible={reminderOpen}
        dailyGoalMinutes={goalMinutes}
        busy={reminderBusy}
        onAccept={() => void acceptReminder()}
        onDecline={declineReminder}
      />
    </Screen>
  )
}

// Huy hiệu chuỗi ngày học trên thanh đầu (mẫu `.badge.y`): nền vàng nhạt, glyph chuỗi, số ngày.
function StreakBadge({ days }: { days: number }) {
  const c = useTheme().colors
  return (
    <View
      accessible
      accessibilityLabel={`Chuỗi học ${days} ngày`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 30,
        paddingHorizontal: space[3],
        borderRadius: radius.full,
        backgroundColor: c.accentSoft,
      }}
    >
      <GaGlyph name="chuoi" size={16} ink="primary" />
      <ThemedText variant="label" style={{ fontVariant: ['tabular-nums'] }}>{`${days} ngày`}</ThemedText>
    </View>
  )
}

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: space[5], marginTop: space[5], gap: space[4] }}>
      <Skeleton height={220} radius="2xl" />
      <Skeleton height={140} radius="2xl" />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
        <Skeleton height={120} radius="2xl" style={{ flex: 1 }} />
      </View>
    </View>
  )
}
