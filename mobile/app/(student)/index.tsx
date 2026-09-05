import { useCallback, useEffect, useState } from 'react'
import { View, RefreshControl, Pressable, Alert, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { usePullRefresh } from '@/hooks/usePullRefresh'
import { router, useFocusEffect } from 'expo-router'
import { MotiView } from 'moti'
import { Flame, BookOpen, Mic, Star, Map, Bell, Zap, MessageCircle, type LucideIcon } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { useTourStore } from '@/stores/useTourStore'
import { canAutoStartHomeTour, canAutoStartSrsIntro, probeStatus } from '@/lib/tourEligibility'
import { useStarterStore } from '@/stores/useStarterStore'
import { SpotlightTarget, useSpotlightTour } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'
import { StarterChecklist } from '@/components/guide/StarterChecklist'
import { ReminderSheet } from '@/components/guide/ReminderSheet'
import { getDailyGoalMinutes } from '@/lib/dailyGoal'
import { enableStudyReminder } from '@/lib/studyReminder'
import { registerPushTokenIfGranted } from '@/hooks/usePushNotifications'
import { captureEvent } from '@/lib/analytics'
import api from '@/lib/api'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { lernwegApi, ROADMAP_ME_QUERY_KEY } from '@/lib/lernwegApi'
import { messagesApi } from '@/lib/messagesApi'
import { TodayTasks } from '@/components/home/TodayTasks'
import { motion, space, radius, useTheme } from '@/lib/theme'
import {
  Screen,
  Card,
  ThemedText,
  Icon,
  Pill,
  ListRow,
  SectionHeader,
  Skeleton,
  ErrorState,
  Caption,
  ProgressBar,
  useTabBarClearance,
} from '@/components/ui'

// Only the fields the home actually uses from the (plan-oriented) dashboard.
// XP/level come from /xp/me, SRS due + reviewedCards from /srs/stats, unread from /notifications.
interface DashboardData {
  streakDays: number
  weeklyXp: number
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function DashboardScreen() {
  const theme = useTheme()
  // Thanh tab liquid-glass nổi đè lên nội dung — chừa đáy cho mục cuối.
  const tabClearance = useTabBarClearance()
  const { user } = useAuthStore()
  const { isPro } = usePlanStore()

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

  async function acceptReminder() {
    setReminderBusy(true)
    const outcome = await enableStudyReminder(goalMinutes)
    setReminderBusy(false)
    setReminderOpen(false)

    if (outcome === 'granted') {
      useStarterStore.getState().markReminderEnabled()
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
    captureEvent('onb_reminder_sheet_dismissed', {})
    useStarterStore.getState().declineReminderSheet(Date.now())
    setReminderOpen(false)
  }

  const firstName = user?.displayName?.split(' ').at(-1) ?? 'bạn'
  const greeting = greetingFor(new Date().getHours())
  const level = xp?.level ?? 1
  const totalXp = xp?.totalXp ?? 0
  const weeklyXp = data?.weeklyXp ?? 0
  const dueSrs = srs?.dueCount ?? 0
  const unread = unreadData?.unreadCount ?? 0

  const pull = usePullRefresh(async () => {
    await Promise.all([refetch(), refetchXp(), refetchSrs(), refetchUnread(), refetchMsgUnread()])
  })
  const onRefresh = () => void pull.onRefresh()

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
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: space[5],
          paddingTop: space[3],
          paddingBottom: space[2],
        }}
      >
        <View style={{ gap: 4 }}>
          <Caption>{greeting},</Caption>
          <ThemedText variant="titleLg">{firstName}</ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <HeaderIconButton
            icon={MessageCircle}
            label={msgUnread > 0 ? `Tin nhắn, ${msgUnread} chưa đọc` : 'Tin nhắn'}
            badge={msgUnread}
            onPress={() => router.push('/(student)/messages')}
          />
          <HeaderIconButton
            icon={Bell}
            label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
            badge={unread}
            onPress={() => router.push('/(student)/notifications')}
          />
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
          <View style={{ paddingHorizontal: space[5], marginTop: space[3] }}>
            {/* Streak hero — editorial ink card, the day-one engagement metric */}
            <SpotlightTarget id={SPOTLIGHT_TARGETS.homeStreak}>
            <Card style={{ backgroundColor: theme.colors.inkSurface, borderColor: theme.colors.inkSurface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: radius.lg,
                    backgroundColor: theme.colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon icon={Flame} size={30} color="accent" fill />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Caption color={theme.colors.accent}>Chuỗi học</Caption>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
                    <ThemedText variant="displayLg" style={{ color: theme.colors.onInk }}>
                      {String(data?.streakDays ?? 0)}
                    </ThemedText>
                    <ThemedText variant="bodyStrong" style={{ color: theme.colors.onInkMuted }}>
                      ngày 🔥
                    </ThemedText>
                  </View>
                  <ThemedText variant="caption" style={{ color: theme.colors.onInkMuted }}>
                    Hoàn thành 2 hoạt động mỗi ngày để giữ chuỗi
                  </ThemedText>
                </View>
              </View>
            </Card>
            </SpotlightTarget>

            {/* Secondary stats */}
            <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
              <StatCard icon={Star} accent="accent" value={`Lv ${level}`} label={`${totalXp} XP`} />
              <StatCard icon={Zap} accent="info" value={`+${weeklyXp}`} label="XP tuần này" />
            </View>
          </View>

          {/* Heute (cụm 2, thiết kế 02/09): việc hôm nay từ /today/me — sửa lỗi
              đến hạn + nói/từ vựng theo gợi ý. Thẻ Ôn SRS ngay dưới là "việc"
              thứ tư, giữ nguyên vì nó là mỏ neo tour (homeSrsCard). */}
          <TodayTasks />

          {/* Tuần đầu (§7.1): checklist "Bắt đầu" — chỉ cho user đã qua onboarding v1,
              tự biến mất vĩnh viễn khi hoàn thành đủ. */}
          {onboardedV1 ? (
            <StarterChecklist
              lessonDone={treeDone > 0}
              onEnableReminder={() => {
                captureEvent('onb_reminder_sheet_shown', { trigger: 'checklist' })
                setReminderOpen(true)
              }}
            />
          ) : null}

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
                    <Icon icon={BookOpen} size={20} color="accent" />
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

          {/* Lối vào Lernweg (cụm 3, 02/09; nguồn hợp nhất /roadmap/me từ 05/09) —
              % ở đây và cây ở màn đích cùng một danh sách node. */}
          {treeTotal > 0 ? (
            <Card
              onPress={() => router.push('/(student)/lernweg')}
              accessibilityLabel={`Lộ trình đến B2, ${pathPct}%`}
              style={{ marginHorizontal: space[5], marginTop: space[4], gap: space[3] }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ gap: 6 }}>
                  <Caption>Lộ trình đến B2</Caption>
                  <ThemedText variant="display">{pathPct}%</ThemedText>
                </View>
                <Icon icon={Map} size={24} color="muted" />
              </View>
              <ProgressBar value={pathPct / 100} />
              <ThemedText variant="caption" color="muted">
                {treeDone}/{treeTotal} chặng hoàn thành
              </ThemedText>
            </Card>
          ) : null}

          <View style={{ paddingHorizontal: space[5], marginTop: space[6] }}>
            <SectionHeader title="Hoạt động" />
            <Card padded={false} style={{ paddingHorizontal: space[4] }}>
              <ListRow
                icon={BookOpen}
                iconTone="accent"
                title="Luyện từ vựng SRS"
                subtitle="Flashcard lặp lại ngắt quãng"
                onPress={() => router.push('/(student)/srs')}
              />
              <Divider />
              <ListRow
                icon={Mic}
                iconTone="info"
                title="AI Speaking"
                subtitle="Hội thoại với AI coach"
                onPress={() => router.push('/(student)/speaking')}
              />
            </Card>
          </View>

          {!isPro && PAYWALL_ENABLED ? (
            <Card
              onPress={() => router.push('/(student)/upgrade')}
              elevation="lifted"
              style={{ marginHorizontal: space[5], marginTop: space[6], borderColor: theme.colors.accentSoft }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
                <View style={{ flex: 1, gap: space[1] }}>
                  <Pill label="MyDeutschFlow PRO" tone="accent" icon={Star} />
                  <ThemedText variant="title">Mở khoá toàn bộ tính năng</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    Speaking AI, Mock Exam, Weekly Challenge
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

// Header action: a bordered icon button with an optional unread badge (bell + messages).
function HeaderIconButton({
  icon, label, badge, onPress,
}: {
  icon: LucideIcon
  label: string
  badge: number
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={icon} size={20} color="secondary" />
        {badge > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: radius.full,
              backgroundColor: theme.colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.bg,
            }}
          >
            <ThemedText variant="caption" style={{ color: theme.colors.onBrand, fontSize: 10 }}>
              {badge > 9 ? '9+' : String(badge)}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

function StatCard({
  icon,
  accent,
  value,
  label,
}: {
  icon: typeof Flame
  accent: 'accent' | 'info'
  value: string
  label: string
}) {
  const theme = useTheme()
  const softBg = accent === 'accent' ? theme.colors.accentSoft : theme.colors.infoSoft
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: softBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={icon} size={20} color={accent} />
        </View>
        <View style={{ gap: 2 }}>
          <ThemedText variant="monoLg">{value}</ThemedText>
          <ThemedText variant="caption" color="muted">
            {label}
          </ThemedText>
        </View>
      </View>
    </Card>
  )
}

function Divider() {
  const theme = useTheme()
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />
}

function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: space[5], marginTop: space[3], gap: space[4] }}>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Skeleton height={72} radius="2xl" style={{ flex: 1 }} />
        <Skeleton height={72} radius="2xl" style={{ flex: 1 }} />
      </View>
      <Skeleton height={72} radius="2xl" />
      <Skeleton width={120} height={20} radius="md" />
      <Skeleton height={180} radius="2xl" />
    </View>
  )
}
