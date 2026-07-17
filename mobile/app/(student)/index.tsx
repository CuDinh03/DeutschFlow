import { useCallback, useEffect, useState } from 'react'
import { View, RefreshControl, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { MotiView } from 'moti'
import { Flame, BookOpen, Mic, Star, Map, Bell, Zap, MessageCircle, type LucideIcon } from 'lucide-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { useTourStore } from '@/stores/useTourStore'
import { useStarterStore } from '@/stores/useStarterStore'
import { SpotlightTarget, useSpotlightTour } from '@/components/guide/SpotlightTour'
import { SPOTLIGHT_TARGETS } from '@/components/guide/spotlightTours'
import { StarterChecklist } from '@/components/guide/StarterChecklist'
import { ReminderSheet } from '@/components/guide/ReminderSheet'
import { getDailyGoalMinutes } from '@/lib/dailyGoal'
import { enableStudyReminder } from '@/lib/studyReminder'
import { captureEvent } from '@/lib/analytics'
import api from '@/lib/api'
import { PAYWALL_ENABLED } from '@/lib/paywall'
import { gamificationApi } from '@/lib/gamificationApi'
import { skillTreeApi } from '@/lib/skillTreeApi'
import { messagesApi } from '@/lib/messagesApi'
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
} from '@/components/ui'

// Only the fields the home actually uses from the (plan-oriented) dashboard.
// XP/level come from /xp/me, due-SRS from /srs/count, unread from /notifications.
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
  const { user } = useAuthStore()
  const { isPro } = usePlanStore()

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/student/dashboard').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: xp, refetch: refetchXp } = useQuery({
    queryKey: ['xp-summary'],
    queryFn: () => gamificationApi.getXpSummary(),
    staleTime: 60_000,
  })

  const { data: srs, refetch: refetchSrs } = useQuery({
    queryKey: ['srs-count'],
    queryFn: () => api.get<{ dueCount: number }>('/srs/count').then((r) => r.data),
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

  // Roadmap progress (real skill-tree data, shared cache with the roadmap screen)
  // → the na-home PathCard entry.
  const { data: treeNodes = [] } = useQuery({
    queryKey: ['skill-tree'],
    queryFn: () => skillTreeApi.getMySkillTree(),
    staleTime: 120_000,
  })
  const treeTotal = treeNodes.length
  const treeDone = treeNodes.filter((n) => n.status === 'COMPLETED').length
  const pathPct = treeTotal > 0 ? Math.round((treeDone / treeTotal) * 100) : 0

  const { startTour, activeTourId } = useSpotlightTour()
  const tourHydrated = useTourStore((s) => s.hydrated)
  const tourDone = useTourStore((s) => s.done)
  const dueForIntro = srs?.dueCount ?? 0

  // Q4 (plan onboarding v1): tour spotlight chỉ nổ khi user đáp xuống Trang chủ
  // lần đầu (sau wow moment), delay ~500ms — không auto-mở đè app như tour cũ.
  useFocusEffect(
    useCallback(() => {
      if (!tourHydrated || tourDone.home || activeTourId) return
      const t = setTimeout(() => {
        void getDailyGoalMinutes().then((m) => startTour('home', 'auto', { dailyGoalMinutes: m }))
      }, 500)
      return () => clearTimeout(t)
    }, [tourHydrated, tourDone.home, activeTourId, startTour]),
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
  // render thật (dueSrs > 0) sau khi tour chính đã xong.
  useFocusEffect(
    useCallback(() => {
      if (!tourHydrated || !tourDone.home || tourDone.srs_intro || activeTourId || reminderOpen || dueForIntro <= 0)
        return
      const t = setTimeout(() => startTour('srs_intro', 'auto', { dueCount: dueForIntro }), 600)
      return () => clearTimeout(t)
    }, [tourHydrated, tourDone.home, tourDone.srs_intro, activeTourId, reminderOpen, dueForIntro, startTour]),
  )

  const firstActivityDone = treeDone > 0 || starterSrsReviews > 0 || speakingStarted

  // §7.2: pre-permission — sheet ngữ cảnh chỉ SAU khi user hoàn thành hoạt động
  // đầu tiên, không xin quyền lúc mở app. Từ chối sheet → hỏi lại sau cooldown.
  useFocusEffect(
    useCallback(() => {
      if (!starterHydrated || !tourHydrated || !tourDone.first_sentence) return
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
      tourDone.first_sentence,
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
    const ok = await enableStudyReminder(goalMinutes)
    setReminderBusy(false)
    setReminderOpen(false)
    if (ok) {
      useStarterStore.getState().markReminderEnabled()
    } else {
      // OS từ chối → cũng vào cooldown, không hỏi dồn dập.
      useStarterStore.getState().declineReminderSheet(Date.now())
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

  const onRefresh = () => {
    void refetch()
    void refetchXp()
    void refetchSrs()
    void refetchUnread()
    void refetchMsgUnread()
  }

  return (
    <Screen
      scroll
      edges={['top']}
      contentStyle={{ paddingBottom: space[8] }}
      refreshing={isRefetching}
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

          {/* Tuần đầu (§7.1): checklist "Bắt đầu" — chỉ cho user đã qua onboarding v1,
              tự biến mất vĩnh viễn khi hoàn thành đủ. */}
          {tourDone.first_sentence ? (
            <StarterChecklist
              lessonDone={treeDone > 0}
              onEnableReminder={() => {
                captureEvent('onb_reminder_sheet_shown', { trigger: 'checklist' })
                setReminderOpen(true)
              }}
            />
          ) : null}

          {dueSrs > 0 ? (
            <SpotlightTarget id={SPOTLIGHT_TARGETS.homeSrsCard}>
            <Card
              onPress={() => router.push('/(student)/srs')}
              bordered
              style={{ marginHorizontal: space[5], marginTop: space[4], borderColor: theme.colors.accentSoft }}
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

          {/* Roadmap progress entry (na-home PathCard) — real skill-tree % to B2. */}
          {treeTotal > 0 ? (
            <Card
              onPress={() => router.push('/(student)/roadmap')}
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
              <Divider />
              <ListRow
                icon={Map}
                iconTone="success"
                title="Lộ trình học"
                subtitle="Skill tree A1 đến B2"
                onPress={() => router.push('/(student)/roadmap')}
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
